/**
 * Debug utilities for logging and error handling
 */

const APP_NAME = 'JackTheEther'

export const debug = {
  /**
   * Log a debug message with component context
   * @param component - The component name
   * @param action - The action being performed
   * @param data - Optional data to log
   */
  log: (component: string, action: string, data?: unknown) => {
    console.log(`[${APP_NAME}][${component}] ${action}`, data || '')
  },

  /**
   * Log an error with component context
   * @param component - The component name
   * @param action - The action that failed
   * @param error - The error object
   */
  error: (component: string, action: string, error: unknown) => {
    console.error(`[${APP_NAME}][${component}] ${action} failed:`, error)
  },
}
