/**
 * Firebase Re-export Module
 * 
 * Re-exports initialized Firebase instances from `/src/firebase.ts`
 * to maintain strict single-instance initialization and backward compatibility.
 */

import { app, auth, db, storage, firebaseConfig } from '../firebase';

export { app, auth, db, storage, firebaseConfig };
export default app;
