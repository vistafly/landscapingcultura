// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyBZglqowz2YZ__PXVeV3CjsIXc9eaCV2FM",
    authDomain: "cultura-landscaping.firebaseapp.com",
    projectId: "cultura-landscaping",
    storageBucket: "cultura-landscaping.firebasestorage.app",
    messagingSenderId: "332304158483",
    appId: "1:332304158483:web:06eb162447073fa25354e6",
    measurementId: "G-KGL3ZYJY9H"
};

// Initialize Firebase
let db = null;
let analytics = null;

if (typeof firebase !== 'undefined') {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        analytics = firebase.analytics();
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
} else {
    console.warn('Firebase SDK not loaded');
}

// Export for use in other modules
window.firebaseDb = db;
window.firebaseAnalytics = analytics;

export { db, analytics, firebaseConfig };