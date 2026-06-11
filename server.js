import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

config({ path: path.join(__dirname, '.env') })

const app = express()
const port = process.env.PORT || 4500

app.use(createProxyMiddleware({
  pathFilter: process.env.APPLICATION_BASE_URL,
  target: process.env.API_ENDPOINT,
  changeOrigin: true,
  logger: console,
}))

app.use(express.static(path.join(__dirname, 'dist')))

app.get('*', (req, res) => {
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
