/**
 * FORJA RPG - FORJAPP Firebase Service
 * Lazy-loads Firebase SDK from CDN and provides auth + Firestore access
 * to import characters directly from the FORJAPP cloud database.
 *
 * Auth strategy: Opens auth.html (served by Foundry on same origin) as a popup.
 * That page handles Google OAuth via signInWithRedirect, then sends the
 * credentials back via postMessage. This avoids cross-origin popup issues
 * that occur when signInWithPopup tries to communicate between
 * forjapp.firebaseapp.com and localhost.
 */

const FIREBASE_VERSION = "11.0.0";
const CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDCs6d0Z-VQAi1_tZoar_R7fk2w7-IXq8U",
  authDomain: "forjapp.firebaseapp.com",
  projectId: "forjapp",
  storageBucket: "forjapp.firebasestorage.app",
  messagingSenderId: "838748075347",
  appId: "1:838748075347:web:6fb0847ec5156aeb175da6"
};

// Auth timeout (2 minutes)
const AUTH_TIMEOUT_MS = 120_000;
const CHANNEL_NAME = "forjapp-auth-channel";

// Singleton references
let _app = null;
let _auth = null;
let _db = null;
let _firebaseModules = null;
let _currentUser = null;

/**
 * Lazy-load Firebase SDK modules from CDN.
 */
async function _loadFirebaseSDK() {
  if (_firebaseModules) return _firebaseModules;

  const [appMod, authMod, firestoreMod] = await Promise.all([
    import(`${CDN_BASE}/firebase-app.js`),
    import(`${CDN_BASE}/firebase-auth.js`),
    import(`${CDN_BASE}/firebase-firestore.js`)
  ]);

  _firebaseModules = { appMod, authMod, firestoreMod };
  return _firebaseModules;
}

/**
 * Initialize Firebase app, auth, and Firestore (singleton).
 */
async function _initFirebase() {
  if (_app && _auth && _db) return { app: _app, auth: _auth, db: _db };

  const { appMod, authMod, firestoreMod } = await _loadFirebaseSDK();

  // Check if already initialized (avoid duplicate app error)
  try {
    _app = appMod.getApp("forjapp-foundry");
  } catch {
    _app = appMod.initializeApp(FIREBASE_CONFIG, "forjapp-foundry");
  }

  _auth = authMod.getAuth(_app);
  _db = firestoreMod.getFirestore(_app);

  return { app: _app, auth: _auth, db: _db };
}

/**
 * Sign in with Google via a popup window that handles OAuth redirect.
 *
 * Opens auth.html (served from Foundry's system directory, same origin)
 * which handles the Google OAuth flow via signInWithRedirect.
 * After auth, auth.html sends credentials back via BroadcastChannel
 * (works even when window.opener is null, which happens in Electron).
 * We then use signInWithCredential to authenticate in the main window.
 *
 * @returns {Promise<object>} User object with uid, displayName, email
 */
export function signIn() {
  return new Promise((resolve, reject) => {
    // Open the auth helper page as a popup (same origin = no cross-origin issues)
    const popup = window.open(
      "/systems/forja/auth.html",
      "forjapp-auth",
      "width=500,height=600,menubar=no,toolbar=no,location=no"
    );

    if (!popup) {
      reject(new Error("Popup blocked. Please allow popups for this site."));
      return;
    }

    let resolved = false;

    // Listen for auth result via BroadcastChannel
    // (window.opener is null in Electron, so postMessage won't work)
    const channel = new BroadcastChannel(CHANNEL_NAME);

    function cleanup() {
      channel.close();
      clearTimeout(timer);
      clearInterval(checkClosed);
    }

    channel.onmessage = async (event) => {
      const data = event.data;
      if (data?.type !== "forjapp-auth-result") return;
      resolved = true;
      cleanup();

      if (!data.success) {
        reject(new Error(data.error || "Authentication failed"));
        return;
      }

      try {
        // Initialize Firebase in main window if not done yet
        await _initFirebase();
        const { authMod } = _firebaseModules;

        // Try to sign in with Google credential from popup
        if (data.googleIdToken || data.googleAccessToken) {
          const credential = authMod.GoogleAuthProvider.credential(
            data.googleIdToken,
            data.googleAccessToken
          );
          const result = await authMod.signInWithCredential(_auth, credential);
          _currentUser = result.user;
          resolve({
            uid: result.user.uid,
            displayName: result.user.displayName,
            email: result.user.email
          });
        } else if (data.user) {
          // Fallback: use user data directly
          _currentUser = data.user;
          resolve(data.user);
        } else {
          reject(new Error("No credential received from auth popup"));
        }
      } catch (err) {
        console.error("FORJA | signInWithCredential failed:", err);
        // Even if credential sign-in fails, use the user info directly
        if (data.user && data.firebaseIdToken) {
          _currentUser = {
            ...data.user,
            _firebaseIdToken: data.firebaseIdToken
          };
          resolve(_currentUser);
        } else {
          reject(err);
        }
      }
    };

    // Timeout
    const timer = setTimeout(() => {
      if (resolved) return;
      cleanup();
      if (popup && !popup.closed) popup.close();
      reject(new Error("Authentication timed out"));
    }, AUTH_TIMEOUT_MS);

    // Detect if popup is closed manually
    const checkClosed = setInterval(() => {
      if (resolved) { clearInterval(checkClosed); return; }
      if (popup.closed) {
        clearInterval(checkClosed);
        if (!resolved) {
          cleanup();
          reject(new Error("Authentication window was closed"));
        }
      }
    }, 500);
  });
}

/**
 * Sign out from Firebase.
 */
export async function signOut() {
  if (_auth && _firebaseModules) {
    const { authMod } = _firebaseModules;
    await authMod.signOut(_auth);
  }
  _currentUser = null;
}

/**
 * Get the currently signed-in user (or null).
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  if (_currentUser) return _currentUser;
  if (_auth) return _auth.currentUser;
  return null;
}

/**
 * Get all characters belonging to a specific user.
 * @param {string} userId - Firebase UID
 * @returns {Promise<object[]>} Array of character objects
 */
export async function getUserCharacters(userId) {
  const { db } = await _initFirebase();
  const { firestoreMod } = _firebaseModules;

  try {
    const q = firestoreMod.query(
      firestoreMod.collection(db, "characters"),
      firestoreMod.where("userId", "==", userId),
      firestoreMod.orderBy("updatedAt", "desc")
    );
    const snapshot = await firestoreMod.getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (err) {
    // Fallback without ordering if index not ready
    console.warn("FORJAPP | Index not ready, using client-side sort:", err);
    const q = firestoreMod.query(
      firestoreMod.collection(db, "characters"),
      firestoreMod.where("userId", "==", userId)
    );
    const snapshot = await firestoreMod.getDocs(q);
    const chars = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return chars.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

/**
 * Get all public and approved characters.
 * @returns {Promise<object[]>}
 */
export async function getPublicCharacters() {
  const { db } = await _initFirebase();
  const { firestoreMod } = _firebaseModules;

  try {
    const q = firestoreMod.query(
      firestoreMod.collection(db, "characters"),
      firestoreMod.where("isPublic", "==", true),
      firestoreMod.where("isApproved", "==", true),
      firestoreMod.orderBy("updatedAt", "desc")
    );
    const snapshot = await firestoreMod.getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (err) {
    console.warn("FORJAPP | Index not ready for public query:", err);
    const q = firestoreMod.query(
      firestoreMod.collection(db, "characters"),
      firestoreMod.where("isPublic", "==", true),
      firestoreMod.where("isApproved", "==", true)
    );
    const snapshot = await firestoreMod.getDocs(q);
    const chars = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return chars.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

/**
 * Get system template characters (read-only, no auth needed per rules).
 * @returns {Promise<object[]>}
 */
export async function getSystemCharacters() {
  const { db } = await _initFirebase();
  const { firestoreMod } = _firebaseModules;

  const snapshot = await firestoreMod.getDocs(
    firestoreMod.collection(db, "systemCharacters")
  );
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

/**
 * Check if Firebase SDK has been loaded already.
 */
export function isLoaded() {
  return _firebaseModules !== null;
}

/**
 * Pre-initialize Firebase completely (SDK + app + auth + db).
 * Call this early (e.g. when FORJAPP tab is shown) so that
 * Firestore queries work immediately after sign-in.
 */
export async function preload() {
  await _initFirebase();
}
