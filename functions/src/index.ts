import { format } from 'date-fns'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

import { Contact } from './models/contacts.model'
import { User } from './models/users.model'

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

/** 毎週土曜のAM 8:00今週の成績が送信される */
const sendAnswerResultByEmailBatch = functions
  .region('asia-northeast1')
  .pubsub.schedule('0 8 * * 6')
  .onRun(async (context) => {
    const users = await admin.firestore().collection('users').get()
    const userList: User[] = users.docs.map((doc) => {
      return {
        uid: doc.data().uid,
        username: doc.data().username,
        email: doc.data().email,
      } as User
    })
    for (const user of userList) {
      const results = await admin
        .firestore()
        .collection('users')
        .doc(user.uid)
        .collection('results')
        .where(
          'executedAt',
          '>=',
          new Date(new Date().setDate(new Date().getDate() - 7))
        )
        .get()
      const result = results.docs.map((doc) => {
        return {
          numberOfCorrect: doc.data().numberOfCorrect,
          numberOfInCorrect: doc.data().numberOfInCorrect,
        }
      })
      const numberOfCorrect = result.reduce((acc, cur) => {
        return acc + cur.numberOfCorrect
      }, 0)
      const numberOfInCorrect = result.reduce((acc, cur) => {
        return acc + cur.numberOfInCorrect
      }, 0)
      let message = 'このメールは自動送信です。\n'
      message += '下記の内容の今週の成績が送信されました。\n\n'
      message += '今週の成績\n'
      message += '問題回答数：' + (numberOfCorrect + numberOfInCorrect) + '\n'
      message += '正解数：' + numberOfCorrect + '\n'
      message += '誤答数：' + numberOfInCorrect + '\n'
      message += '正解率：' + Math.round((numberOfCorrect / 10) * 100) + '%\n'

      try {
        const mailOptions = {
          from: user.email,
          to: 'yaeok.engineer@gmail.com',
          subject: '【定期送信】今週の成績',
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
    }
  })

module.exports = {
  registerUserTriggerFromAuth,
  createContactTriggerFromFirestore,
  sendAnswerResultByEmailBatch,
}
