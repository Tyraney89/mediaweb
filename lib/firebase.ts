import { initializeApp, getApps } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyBi2YgVEP4_9Ou64oOdVAcKfl4xo2Lbe-Y",
  authDomain: "otter-media.firebaseapp.com",
  projectId: "otter-media",
  storageBucket: "otter-media.firebasestorage.app",
  messagingSenderId: "827576146006",
  appId: "1:827576146006:web:5e44873400843704fd43f7",
}

export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
