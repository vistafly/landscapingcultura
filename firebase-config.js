// ==========================================
// FIREBASE CONFIGURATION & INITIALIZATION
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

function initializeFirebase() {
    if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            
            // Use the newer cache settings instead of enablePersistence
            // Remove this deprecated method:
            // db.enablePersistence().catch((err) => {
            //     console.warn('Firebase persistence failed:', err.code);
            // });
            
            if (firebase.analytics) {
                analytics = firebase.analytics();
            }
            
            // Make globally available
            window.firebaseDb = db;
            window.firebaseAnalytics = analytics;
            
            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase initialization error:', error);
            return false;
        }
    }
    return firebase.apps.length > 0;
}

// Auto-initialize when script loads
if (typeof firebase !== 'undefined') {
    initializeFirebase();
} else {
    window.addEventListener('load', () => {
        if (typeof firebase !== 'undefined') {
            initializeFirebase();
        }
    });
}

window.initializeFirebase = initializeFirebase;