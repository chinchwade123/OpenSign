// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyABIYqNGFE5sl565UgDiUat011PWRxDA90", // From user
  authDomain: "digitalsign-cb6a2.firebaseapp.com", // From user
  databaseURL: "https://digitalsign-cb6a2-default-rtdb.firebaseio.com", // From user
  projectId: "digitalsign-cb6a2", // From user
  storageBucket: "digitalsign-cb6a2.firebasestorage.app", // From user
  messagingSenderId: "387600725226", // From user
  appId: "1:387600725226:web:27235913fb7a1dbcf21393", // From user
  measurementId: "G-PEES2RH7X8" // From user, optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// const analytics = getAnalytics(app); // If you need analytics

// Export Firebase services
export { app, auth };
