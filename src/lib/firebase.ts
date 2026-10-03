import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Firebaseのウェブ用設定（公開されて問題ない値。データはfirestore.rulesで守る）
const app = initializeApp({
  apiKey: 'AIzaSyB-aM61o7e2qgHLaSwK9TNaM9DaCpH97cQ',
  // アプリを workout-rpg.firebaseapp.com で開くと、ログイン画面と同じドメインになりスマホでも安定する
  authDomain: 'workout-rpg.firebaseapp.com',
  projectId: 'workout-rpg',
  storageBucket: 'workout-rpg.firebasestorage.app',
  messagingSenderId: '267524061423',
  appId: '1:267524061423:web:558574cbd326627b70431a',
})

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// 電波が悪くても記録でき、つながったときに自動で同期する
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
