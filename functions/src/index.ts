import { format } from 'date-fns'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

import { Contact } from './models/contact.model'

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
  service: 'Gmail',
  auth: {
    user: 'yaeok.engineer@gmail.com',
    pass: 'xyfbeflnxvilpupe',
  },
})
/** firestoreのcontactsに新規作成されたときに動作する処理 */
const createContactTriggerFromFirestore = functions
  .region('asia-northeast1')
  .firestore.document('contacts/{contactId}')
  .onCreate(async (snapshot, context) => {
    const timestamp = snapshot.data().createdAt.seconds
    const date = new Date(parseInt(timestamp, 10) * 1000)
    const contact: Contact = {
      contactId: snapshot.id,
      contactTitle: snapshot.data().contactTitle,
      contactContent: snapshot.data().contactContent,
      contactFrom: snapshot.data().contactFrom,
      createdAt: date,
    }
    let message = 'このメールは自動送信です。\n'
    message += '下記の内容のお問い合わせがありました。\n\n'
    message += '～～～～～～～～～～～～～～～～～～～～～～～～～～\n'
    message += `タイトル　　　　：\n　${contact.contactTitle}\n`
    message += `問い合わせ内容　：\n　${contact.contactContent}\n`
    message += `ユーザ名　　　　：\n　${contact.contactFrom.username}\n`
    message += `日時　　　　　　：\n　${format(
      contact.createdAt,
      'yyyy-MM-dd'
    )}\n`
    message += '～～～～～～～～～～～～～～～～～～～～～～～～～～\n'
    try {
      const mailOptions = {
        from: 'yaeok.engineer@gmail.com',
        to: 'yaeok.engineer@gmail.com',
        subject: '資格アプリに問い合わせがありました',
        text: message,
      }

      await transporter.sendMail(mailOptions, (error, info) => {
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
      logColRef.add({
        status: 'error',
        message: error,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      return
    }
  })

module.exports = {
  registerUserTriggerFromAuth,
  createContactTriggerFromFirestore,
}
