import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

let nodemailer = require('nodemailer')
let serviceAccount = require('../serviceAccountKey.json')

/** Firebaseの初期化 */
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

/** エラーログのコレクションパス */
const logColRef = admin.firestore().collection('logs')

/** usersコレクションのパス */
const usersColRef = admin.firestore().collection('users')

/** Authにユーザが新規登録されたときに動作する処理  */
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

/** Gmail送信用の設定変数 */
let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'yaeok.engineer@gmail',
    pass: 'Yaeo0822',
  },
})
/** firestoreのcontactsに新規作成されたときに動作する処理 */
const createContactTriggerFromFirestore = functions
  .region('asia-northeast1')
  .firestore.document('contacts/{contactId}')
  .onCreate(async (snapshot, context) => {
    try {
      const mailOptions = {
        from: 'yaeok.engineer@gmail.com',
        to: 'k.yaeo@carep-tech.com',
        subject: 'cloud functionsからのメール',
        html: 'これはサンプルのメールです',
      }

      return transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return logColRef.add({
            status: 'error',
            message: error,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
        return logColRef.add({
          status: 'success',
          message: 'メールが正常に送信されました',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      })
    } catch (error) {
      console.error(error)
      return
    }
  })

module.exports = {
  registerUserTriggerFromAuth,
  createContactTriggerFromFirestore,
}
