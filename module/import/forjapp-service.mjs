/**
 * FORJA RPG - FORJAPP Firebase Service
 * Lazy-loads Firebase SDK from CDN and provides auth + Firestore access
 * to import characters directly from the FORJAPP cloud database.
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

// Singleton references
let _app = null;
let _auth = null;
let _db = null;
let _firebaseModules = null;

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
 * Sign in with Google via popup.
 * IMPORTANT: preload() must be called before this method so Firebase is
 * already initialized. Otherwise the async gap between user click and
 * popup open will cause browsers to block the popup.
 * @returns {Promise<object>} Firebase User object
 */
export function signIn() {
  if (!_auth || !_firebaseModules) {
    return Promise.reject(new Error("Firebase not initialized. Call preload() first."));
  }
  const { authMod } = _firebaseModules;
  const provider = new authMod.GoogleAuthProvider();
  // Call signInWithPopup synchronously (no await before it) to preserve user gesture
  return authMod.signInWithPopup(_auth, provider).then(result => result.user);
}

/**
 * Sign out from Firebase.
 */
export async function signOut() {
  const { auth } = await _initFirebase();
  const { authMod } = _firebaseModules;
  await authMod.signOut(auth);
}

/**
 * Get the currently signed-in user (or null).
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  const { auth } = await _initFirebase();
  return auth.currentUser;
}

/**
 * Subscribe to auth state changes.
 * @param {Function} callback - Called with (user) or (null)
 * @returns {Promise<Function>} Unsubscribe function
 */
export async function onAuthChange(callback) {
  const { auth } = await _initFirebase();
  const { authMod } = _firebaseModules;
  return authMod.onAuthStateChanged(auth, callback);
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
 * Get all public and approved characters (no auth required for Firestore read,
 * but Firebase Auth is still needed per Firestore rules).
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
 * Call this early (e.g. when FORJAPP tab is shown) so that signIn()
 * can open the popup synchronously within the user gesture window.
 */
export async function preload() {
  await _initFirebase();
}
