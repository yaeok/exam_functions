import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

let serviceAccount = require('../serviceAccountKey.json')

// const app = express()

/** Firebaseの初期化 */
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

/** Authentication処理 */
const usersColRef = admin.firestore().collection('users')

/** Authトリガー  */
const registerUserTriggerFromAuth = functions
  .region('asia-northeast1')
  .auth.user()
  .onCreate(async (user) => {
    try {
      await usersColRef.doc(user.uid).set({
        uid: user.uid,
        username:
          user.displayName || user.email?.split('@')[0] || 'ユーザ名未設定',
        email: user.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      return
    } catch (error) {
      console.error(error)
      return
    }
  })

module.exports = {
  registerUserTriggerFromAuth,
}
