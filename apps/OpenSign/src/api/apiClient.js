import axios from 'axios';
import { auth } from '../firebaseConfig'; // Adjust path as necessary
import { appInfo } from '../constant/appinfo'; // Adjust path as necessary

const apiClient = axios.create({
  baseURL: appInfo.apiBaseUrl, // Set base URL from our config
});

// Request interceptor to add Firebase ID token to headers
apiClient.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const idToken = await user.getIdToken();
        config.headers.Authorization = `Bearer ${idToken}`;
      } catch (error) {
        console.error("Error getting ID token for API request:", error);
        // Optionally, handle token refresh errors or prevent request
        // For example, could redirect to login or show an error
        // return Promise.reject(error); // This would stop the request
      }
    }
    return config;
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  }
);

// Optional: Response interceptor for global error handling (e.g., 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return response;
  },
  async (error) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      // Here you could try to refresh the token if Firebase SDK didn't do it automatically,
      // or redirect to login.
      // For Firebase, getIdToken() usually handles refresh. If it still fails with 401,
      // it might mean the session is truly invalid or backend expects something else.
      console.error("Axios interceptor: 401 Unauthorized. User may need to re-authenticate.", error.response);
      // Example: auth.signOut().then(() => window.location.href = '/login');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
