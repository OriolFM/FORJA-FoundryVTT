/**
 * FORJA RPG - FORJAPP Firebase Service
 * Lazy-loads Firebase SDK from CDN and provides auth + Firestore access
 * to import characters directly from the FORJAPP cloud database.
 *
 * Auth strategy: User signs in via auth.html (opens in browser/popup),
 * copies a code, and pastes it back into Foundry. This avoids all
 * cross-window communication issues in Electron.
 */

const FIREBASE_VERSION = "11.0.0";
const CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

// Non-sensitive Firebase project identifiers (public by design — no secrets here).
// The API key is stored separately in Foundry world settings (configured by the GM).
const FIREBASE_PROJECT = {
  authDomain: "forjapp.firebaseapp.com",
  projectId: "forjapp",
  storageBucket: "forjapp.firebasestorage.app",
  messagingSenderId: "838748075347",
  appId: "1:838748075347:web:6fb0847ec5156aeb175da6"
};

function _getFirebaseConfig() {
  const apiKey = game?.settings?.get("forja", "forjappApiKey") ?? "";
  return { apiKey, ...FIREBASE_PROJECT };
}

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
 * Initialize Firebase app, auth, and Firestore.
 */
async function _initFirebase() {
  if (_app && _auth && _db) return { app: _app, auth: _auth, db: _db };

  const { appMod, authMod, firestoreMod } = await _loadFirebaseSDK();

  try {
    _app = appMod.getApp("forjapp-foundry");
  } catch {
    _app = appMod.initializeApp(_getFirebaseConfig(), "forjapp-foundry");
  }

  try {
    _auth = authMod.initializeAuth(_app, {
      persistence: authMod.browserSessionPersistence,
      popupRedirectResolver: authMod.browserPopupRedirectResolver
    });
  } catch {
    _auth = authMod.getAuth(_app);
  }

  _db = firestoreMod.getFirestore(_app);

  return { app: _app, auth: _auth, db: _db };
}

/**
 * Sign in using a code pasted from auth.html.
 * The code is base64-encoded JSON with Google/Firebase tokens.
 *
 * @param {string} code - The auth code from auth.html
 * @returns {Promise<object>} User object with uid, displayName, email
 */
export async function signInWithCode(code) {
  // Decode the code
  let data;
  try {
    data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  } catch {
    throw new Error("Invalid authentication code");
  }

  if (data.v !== 1) {
    throw new Error("Unsupported code version");
  }

  await _initFirebase();
  const { authMod } = _firebaseModules;

  // Try signInWithCredential for full Firestore auth
  if (data.git || data.gat) {
    try {
      const credential = authMod.GoogleAuthProvider.credential(data.git, data.gat);
      console.log("FORJA | Attempting signInWithCredential...");
      const result = await authMod.signInWithCredential(_auth, credential);
      console.log("FORJA | signInWithCredential succeeded, uid:", result.user.uid);
      _currentUser = result.user;
      return {
        uid: result.user.uid,
        displayName: result.user.displayName,
        email: result.user.email
      };
    } catch (err) {
      console.warn("FORJA | signInWithCredential failed, using fallback:", err.message);
    }
  }

  // Fallback: use the user data directly from the code
  if (data.uid) {
    console.log("FORJA | Using direct user data from code, uid:", data.uid);
    _currentUser = {
      uid: data.uid,
      displayName: data.dn,
      email: data.em,
      _firebaseIdToken: data.fit
    };
    return _currentUser;
  }

  throw new Error("Invalid authentication data");
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
 */
export async function preload() {
  await _initFirebase();
}
