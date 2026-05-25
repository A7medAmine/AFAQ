// Progres MESRS auto-fill integration
import { useState, useRef, useCallback } from 'react'

const AUTH_URL = '/api/progres/auth'
const STUDENT_URL = '/api/progres/student'

export default function useProgresAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [studentData, setStudentData] = useState(null)
  const tokenRef = useRef(null)

  const login = useCallback(async (username, password) => {
    setLoading(true)
    setError(null)
    setStudentData(null)
    try {
      const authRes = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!authRes.ok) {
        const errData = await authRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Authentication failed.')
      }
      const { token, uuid, userName } = await authRes.json()
      tokenRef.current = token

      const studentRes = await fetch(`${STUDENT_URL}?uuid=${encodeURIComponent(uuid)}`, {
        headers: { Authorization: token },
      })
      tokenRef.current = null

      if (!studentRes.ok) {
        const errData = await studentRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to fetch student data.')
      }
      const data = await studentRes.json()
      data.userName = userName
      setStudentData(data)
      return data
    } catch (err) {
      tokenRef.current = null
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setStudentData(null)
    tokenRef.current = null
  }, [])

  return { login, loading, error, studentData, reset }
}
