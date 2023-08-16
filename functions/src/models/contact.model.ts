export interface Contact {
  contactId: string
  contactTitle: string
  contactContent: string
  contactFrom: {
    uid: string
    username: string
    email: string
  }
  createdAt: Date
}
