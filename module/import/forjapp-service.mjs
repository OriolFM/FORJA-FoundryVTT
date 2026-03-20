/**
 * FORJA RPG - FORJAPP Firebase Service
 * Lazy-loads Firebase SDK from CDN and provides auth + Firestore access
 * to import characters directly from the FORJAPP cloud database.
 *
 * Auth strategy: user signs in via auth.html (opens in popup), which writes
 * the auth tokens to Firestore authSessions/{sessionId}. Foundry polls that
 * document every 2 s and signs in automatically once it appears.
 * The session is persisted locally so re-auth is only needed after logout.
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
let _authStateResolved = false; // true after first onAuthStateChanged fires

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
 * Wait for the Firebase Auth state to resolve (restores persisted session).
 * Resolves immediately if already resolved.
 */
function _waitForAuthState() {
  if (_authStateResolved) return Promise.resolve();
  return new Promise(resolve => {
    const { authMod } = _firebaseModules;
    const unsub = authMod.onAuthStateChanged(_auth, user => {
      unsub();
      if (user && !_currentUser) {
        _currentUser = user;
        console.log("FORJA | Auth session restored from persistence, uid:", user.uid);
      }
      _authStateResolved = true;
      resolve();
    });
  });
}

/**
 * Initialize Firebase app, auth (with local persistence), and Firestore.
 * Waits for the initial auth state so persisted sessions are restored.
 */
async function _initFirebase() {
  if (_app && _auth && _db) {
    if (!_authStateResolved) await _waitForAuthState();
    return { app: _app, auth: _auth, db: _db };
  }

  const { appMod, authMod, firestoreMod } = await _loadFirebaseSDK();

  try {
    _app = appMod.getApp("forjapp-foundry");
  } catch {
    _app = appMod.initializeApp(_getFirebaseConfig(), "forjapp-foundry");
  }

  try {
    // browserLocalPersistence keeps the session across Foundry restarts
    _auth = authMod.initializeAuth(_app, {
      persistence: authMod.browserLocalPersistence,
      popupRedirectResolver: authMod.browserPopupRedirectResolver
    });
  } catch {
    _auth = authMod.getAuth(_app);
  }

  _db = firestoreMod.getFirestore(_app);

  // Wait for auth to restore any previously persisted session
  await _waitForAuthState();

  return { app: _app, auth: _auth, db: _db };
}

// ── Auth helpers ───────────────────────────────────────────────────────────

/**
 * Shared sign-in logic used by both code-paste and polling flows.
 * data: { v, fit, git, gat, rt, uid, dn, em }
 */
async function _signInFromSession(data) {
  const { authMod } = _firebaseModules;

  // Try full Firebase credential if Google tokens are present
  if (data.git || data.gat) {
    try {
      const credential = authMod.GoogleAuthProvider.credential(data.git, data.gat);
      console.log("FORJA | Attempting signInWithCredential...");
      const result = await authMod.signInWithCredential(_auth, credential);
      console.log("FORJA | signInWithCredential succeeded, uid:", result.user.uid);
      _currentUser = result.user;
      // Save userId for settings display
      _saveUserIdToSettings(result.user.uid);
      return {
        uid: result.user.uid,
        displayName: result.user.displayName,
        email: result.user.email
      };
    } catch (err) {
      console.warn("FORJA | signInWithCredential failed, using token fallback:", err.message);
    }
  }

  // Fallback: use the user data directly from the session payload
  if (data.uid) {
    console.log("FORJA | Using direct user data, uid:", data.uid);
    _currentUser = {
      uid: data.uid,
      displayName: data.dn ?? null,
      email: data.em ?? null,
      _firebaseIdToken: data.fit,
      _refreshToken: data.rt ?? null,
      _tokenExpiry: Date.now() + 55 * 60 * 1000 // 55 min
    };
    _saveUserIdToSettings(data.uid);
    return _currentUser;
  }

  throw new Error("Invalid authentication data in session payload");
}

function _saveUserIdToSettings(uid) {
  try { game.settings.set("forja", "forjappUserId", uid); } catch { /* ignore */ }
}

/**
 * Refresh a Firebase ID token using the refresh token REST endpoint.
 * Returns the new ID token string.
 */
async function _refreshIdToken(refreshToken) {
  const apiKey = game?.settings?.get("forja", "forjappApiKey") ?? "";
  const resp = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: refreshToken })
    }
  );
  if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status}`);
  const data = await resp.json();

  // Update stored user if we have one
  if (_currentUser?._refreshToken !== undefined) {
    _currentUser._firebaseIdToken = data.id_token;
    _currentUser._refreshToken    = data.refresh_token;
    _currentUser._tokenExpiry     = Date.now() + 55 * 60 * 1000;
  }
  return data.id_token;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Sign in using a base64 code pasted from auth.html (legacy / fallback flow).
 * @param {string} code - The auth code from auth.html
 * @returns {Promise<object>} User object
 */
export async function signInWithCode(code) {
  let data;
  try {
    data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  } catch {
    throw new Error("Invalid authentication code");
  }

  if (data.v !== 1 && data.v !== 2) {
    throw new Error("Unsupported code version");
  }

  await _initFirebase();
  return _signInFromSession(data);
}

/**
 * Eagerly load the Firebase SDK so it is ready before the user clicks.
 * Call this when the importer dialog opens (fire-and-forget).
 */
export function preInitialize() {
  _initFirebase().catch(() => {}); // errors surfaced later on actual sign-in
}

/**
 * Sign in with Google via a popup opened directly from the Foundry window.
 * Works in both browser and Electron (no separate auth.html window needed).
 * @returns {Promise<{uid, displayName, email}>}
 */
export async function signInWithGoogle() {
  await _initFirebase();
  const { authMod } = _firebaseModules;
  const provider = new authMod.GoogleAuthProvider();
  const result = await authMod.signInWithPopup(_auth, provider);
  _currentUser = result.user;
  _saveUserIdToSettings(result.user.uid);
  return {
    uid:         result.user.uid,
    displayName: result.user.displayName,
    email:       result.user.email
  };
}

/**
 * Poll Firestore for an authSessions/{sessionId} document written by auth.html.
 * Resolves with the user object once the document appears; rejects on timeout
 * or cancellation.
 *
 * @param {string}  sessionId    - Random ID generated by the bridge
 * @param {{ cancelled: boolean }} cancelSignal - Set .cancelled = true to abort
 * @returns {Promise<object>} User object
 */
export async function authenticateViaPolling(sessionId, cancelSignal) {
  await _initFirebase(); // loads SDK + initialises Firestore
  const { firestoreMod } = _firebaseModules;

  const MAX_ATTEMPTS = 150; // 5 min × 2 s intervals

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    if (cancelSignal?.cancelled) throw new Error("Auth cancelled");

    // Wait 2 s between polls (first poll is also after 2 s)
    await new Promise(r => setTimeout(r, 2000));

    if (cancelSignal?.cancelled) throw new Error("Auth cancelled");

    try {
      const docRef = firestoreMod.doc(_db, "authSessions", sessionId);
      const snap   = await firestoreMod.getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();

        // Delete the ephemeral document immediately (fire-and-forget)
        firestoreMod.deleteDoc(docRef).catch(() => {});

        return await _signInFromSession(data);
      }
    } catch (e) {
      // Transient network errors — keep polling
      console.warn("FORJA | Auth polling error (will retry):", e.message);
    }
  }

  throw new Error(game.i18n.localize("FORJA.Errors.AuthTimeout"));
}

/**
 * Get a valid Firebase ID token for the current user, refreshing if expired.
 * Used internally when Firestore SDK does not manage the token automatically
 * (fallback auth path without signInWithCredential).
 * @returns {Promise<string|null>}
 */
export async function getValidIdToken() {
  // Full SDK auth — token is managed automatically
  if (_auth?.currentUser) return _auth.currentUser.getIdToken(false);

  // Fallback path: check stored token
  if (_currentUser?._firebaseIdToken) {
    const expired = _currentUser._tokenExpiry && Date.now() > _currentUser._tokenExpiry - 60_000;
    if (!expired) return _currentUser._firebaseIdToken;

    // Try to refresh
    if (_currentUser._refreshToken) {
      try {
        return await _refreshIdToken(_currentUser._refreshToken);
      } catch (e) {
        console.warn("FORJA | Token refresh failed:", e.message);
      }
    }
  }

  return null;
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
  _authStateResolved = false;
}

/**
 * Get the currently signed-in user (or null).
 * Initialises Firebase if needed so persisted sessions are restored.
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  if (_currentUser) return _currentUser;

  // If Firebase is already initialised, check auth synchronously
  if (_auth) {
    if (_auth.currentUser) {
      _currentUser = _auth.currentUser;
      return _currentUser;
    }
    return null;
  }

  // Firebase not yet initialised — init now so the persisted session is restored
  await _initFirebase();

  if (_auth?.currentUser && !_currentUser) {
    _currentUser = _auth.currentUser;
  }
  return _currentUser ?? null;
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
 * Save (create or overwrite) a character document in Firestore.
 * Requires the user to be signed in.
 * @param {object} characterData - Full character JSON (must have .id)
 * @returns {Promise<void>}
 */
export async function saveCharacter(characterData) {
  const { db } = await _initFirebase();
  const { firestoreMod } = _firebaseModules;

  // Strip undefined fields (Firestore rejects them)
  function cleanUndefined(obj) {
    if (Array.isArray(obj)) return obj.map(cleanUndefined);
    if (obj !== null && typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, cleanUndefined(v)])
      );
    }
    return obj;
  }

  const cleaned = cleanUndefined({ ...characterData, updatedAt: new Date().toISOString() });
  await firestoreMod.setDoc(
    firestoreMod.doc(db, "characters", characterData.id),
    cleaned
  );
}

/**
 * Check if Firebase SDK has been loaded already.
 */
export function isLoaded() {
  return _firebaseModules !== null;
}

/**
 * Pre-initialize Firebase completely (SDK + app + auth + db).
 * Also restores any persisted auth session.
 */
export async function preload() {
  await _initFirebase();
}
