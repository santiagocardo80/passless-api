'use strict'

const db = require('@passless/db')
const { encrypt, decrypt, generateRandomKey } = require('@passless/crypto')
const { getSecretKey } = require('@passless/auth')

async function createSecret (username, name, value) {
  const user = await db.User.findOne({ where: { username } })
  if (!user) throw new Error('User not found')

  const secretKey = await getSecretKey(username)
  const randomKey = user.randomKey
  const encrypted = encrypt(value, secretKey, randomKey)

  return db.Secret.create({
    username,
    name,
    value: encrypted
  })
}

async function listSecrets (username) {
  return db.Secret.findAndCountAll({ where: { username } })
}

async function getSecret (username, name) {
  const user = await db.User.findOne({ where: { username } })
  if (!user) throw new Error('User not found')

  const secret = await db.Secret.findOne({ where: { name } })
  if (!secret) return null

  const secretKey = await getSecretKey(username)
  const randomKey = user.randomKey
  const decrypted = decrypt(secret.value, secretKey, randomKey)
  secret.value = decrypted

  return secret
}

async function updateSecret (username, name, value) {
  const user = await db.User.findOne({ where: { username } })
  if (!user) throw new Error('User not found')

  const secretKey = await getSecretKey(username)
  const randomKey = user.randomKey
  const encrypted = encrypt(value, secretKey, randomKey)

  return db.Secret.update(
    { value: encrypted },
    { where: { username: user.username, name } }
  )
}

async function deleteSecret (username, name) {
  return db.Secret.destroy({
    where: { username, name }
  })
}

async function updateAllSecrets (username, oldKey, newKey) {
  const [user, secrets] = await Promise.all([
    db.User.findOne({ where: { username } }),
    db.Secret.findAll({ where: { username } })
  ])

  const oldRandomKey = user.randomKey
  const newRandomKey = generateRandomKey()

  for await (const secret of secrets.rows) {
    const encryptedValue = secret.value
    const value = decrypt(encryptedValue, oldKey, oldRandomKey)
    secret.value = encrypt(value, newKey, newRandomKey)
    secret.save()
  }
}

module.exports = {
  createSecret,
  listSecrets,
  getSecret,
  updateSecret,
  deleteSecret,
  updateAllSecrets
}
