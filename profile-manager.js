// ==========================================
// PROFILE MANAGER - FIXED VERSION
// ==========================================

class ProfileManager {
    constructor(firebaseManager) {
        this.firebaseManager = firebaseManager;
        this.db = firebaseManager ? firebaseManager.db : null;
        this.userProfile = null;
        this.preferences = this.getDefaultPreferences();
        this.storageKey = 'culturascape_profile';
        
        this.init();
    }

    init() {
        // Load profile from localStorage first for immediate access
        this.loadLocalProfile();
        
        // Then sync with Firebase if available
        if (this.db) {
            this.syncWithFirebase();
        }

        console.log('Profile Manager initialized');
    }

    getDefaultPreferences() {
        return {
            theme: 'light',
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            notifications: true,
            newsletter: false,
            accessibility: {
                highContrast: window.matchMedia('(prefers-contrast: high)').matches,
                largeText: false,
                screenReader: this.detectScreenReader()
            },
            performance: {
                enableParticles: true,
                enableCursor: true,
                enableAnimations: true
            }
        };
    }

    detectScreenReader() {
        return !!(
            navigator.userAgent.match(/NVDA|JAWS|VoiceOver|ChromeVox|Orca|TalkBack/i) ||
            window.speechSynthesis?.speaking ||
            document.querySelector('[aria-live]')
        );
    }

    // LOCAL STORAGE OPERATIONS
    loadLocalProfile() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const profile = JSON.parse(stored);
                this.userProfile = profile.user || null;
                this.preferences = { ...this.preferences, ...profile.preferences };
            }
        } catch (error) {
            console.warn('Failed to load local profile:', error);
        }
    }

    saveLocalProfile() {
        try {
            const profileData = {
                user: this.userProfile,
                preferences: this.preferences,
                lastUpdated: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(profileData));
        } catch (error) {
            console.warn('Failed to save local profile:', error);
        }
    }

    // FIREBASE SYNC OPERATIONS
    async syncWithFirebase() {
        if (!this.db || !this.firebaseManager.userSessionId) return;

        try {
            // Check if profile exists in Firebase
            const profileRef = this.db.collection('user_profiles').doc(this.firebaseManager.userSessionId);
            const profileDoc = await profileRef.get();

            if (profileDoc.exists) {
                // Update local with Firebase data
                const firebaseData = profileDoc.data();
                this.mergeProfile(firebaseData);
            } else {
                // Create new profile in Firebase
                await this.createFirebaseProfile();
            }

        } catch (error) {
            console.error('Firebase profile sync error:', error);
        }
    }

    async createFirebaseProfile() {
        if (!this.db) return;

        try {
            const profileRef = this.db.collection('user_profiles').doc(this.firebaseManager.userSessionId);
            
            const profileData = {
                sessionId: this.firebaseManager.userSessionId,
                user: this.userProfile,
                preferences: this.preferences,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                version: '1.0'
            };

            await profileRef.set(profileData);
            console.log('Profile created in Firebase');

        } catch (error) {
            console.error('Failed to create Firebase profile:', error);
        }
    }

    mergeProfile(firebaseData) {
        // Merge Firebase data with local data, preferring more recent updates
        const localTimestamp = this.getLocalTimestamp();
        const firebaseTimestamp = firebaseData.lastUpdated?.toMillis() || 0;

        if (firebaseTimestamp > localTimestamp) {
            // Firebase is newer, update local
            if (firebaseData.user) {
                this.userProfile = { ...this.userProfile, ...firebaseData.user };
            }
            if (firebaseData.preferences) {
                this.preferences = { ...this.preferences, ...firebaseData.preferences };
            }
            this.saveLocalProfile();
            this.applyPreferences();
        } else if (localTimestamp > firebaseTimestamp) {
            // Local is newer, update Firebase
            this.saveToFirebase();
        }
    }

    getLocalTimestamp() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored).lastUpdated || 0 : 0;
        } catch {
            return 0;
        }
    }

    async saveToFirebase() {
        if (!this.db) return;

        try {
            const profileRef = this.db.collection('user_profiles').doc(this.firebaseManager.userSessionId);
            
            await profileRef.update({
                user: this.userProfile,
                preferences: this.preferences,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            console.error('Failed to save to Firebase:', error);
        }
    }

    // USER PROFILE MANAGEMENT
    setUserInfo(userInfo) {
        this.userProfile = {
            ...this.userProfile,
            ...userInfo,
            lastUpdated: Date.now()
        };
        
        this.saveLocalProfile();
        this.saveToFirebase();
    }

    getUserInfo() {
        return this.userProfile;
    }

    // PREFERENCES MANAGEMENT
    updatePreferences(newPreferences) {
        this.preferences = {
            ...this.preferences,
            ...newPreferences
        };

        this.saveLocalProfile();
        this.saveToFirebase();
        this.applyPreferences();
        
        // Track preference changes
        if (this.firebaseManager) {
            this.firebaseManager.trackInteraction('preference_update', 'settings', null, 'profile');
        }
    }

    getPreferences() {
        return { ...this.preferences };
    }

    applyPreferences() {
        // Apply theme
        this.applyTheme();
        
        // Apply accessibility preferences
        this.applyAccessibilityPreferences();
        
        // Apply performance preferences
        this.applyPerformancePreferences();
        
        console.log('Preferences applied:', this.preferences);
    }

    applyTheme() {
        const theme = this.preferences.theme || 'light';
        
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        // Update CSS custom properties based on theme
        const root = document.documentElement;
        if (theme === 'dark') {
            root.style.setProperty('--bg-primary', '#0a0a0a');
            root.style.setProperty('--text-primary', '#f5f5f5');
            root.style.setProperty('--card-bg', '#1a1a1a');
        } else {
            root.style.setProperty('--bg-primary', '#fdfdf9');
            root.style.setProperty('--text-primary', '#2d3748');
            root.style.setProperty('--card-bg', '#ffffff');
        }
    }

    applyAccessibilityPreferences() {
        const { accessibility } = this.preferences;
        
        // High contrast
        if (accessibility.highContrast) {
            document.body.classList.add('high-contrast');
        } else {
            document.body.classList.remove('high-contrast');
        }

        // Large text
        if (accessibility.largeText) {
            document.body.classList.add('large-text');
        } else {
            document.body.classList.remove('large-text');
        }

        // Screen reader optimizations
        if (accessibility.screenReader) {
            document.body.classList.add('screen-reader');
            this.enhanceScreenReaderExperience();
        }
    }

    enhanceScreenReaderExperience() {
        // Add screen reader specific improvements
        const skipLink = document.querySelector('.skip-link');
        if (skipLink) {
            skipLink.style.display = 'block';
        }

        // Ensure all interactive elements have proper labels
        this.addAriaLabels();
        
        // Add live regions for dynamic content
        this.setupLiveRegions();
    }

    addAriaLabels() {
        // Service cards
        const serviceCards = document.querySelectorAll('.service-luxury-card');
        serviceCards.forEach((card, index) => {
            if (!card.getAttribute('aria-label')) {
                const title = card.querySelector('h3')?.textContent || `Service ${index + 1}`;
                card.setAttribute('aria-label', `Learn more about ${title}`);
                card.setAttribute('role', 'button');
                card.setAttribute('tabindex', '0');
            }
        });

        // Portfolio items
        const portfolioItems = document.querySelectorAll('.portfolio-luxury-item');
        portfolioItems.forEach((item, index) => {
            if (!item.getAttribute('aria-label')) {
                const title = item.querySelector('h4')?.textContent || `Portfolio item ${index + 1}`;
                item.setAttribute('aria-label', `View ${title} project details`);
            }
        });

        // Form fields
        const formFields = document.querySelectorAll('input, select, textarea');
        formFields.forEach(field => {
            if (!field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby')) {
                const label = field.parentElement.querySelector('label') || 
                             field.parentElement.querySelector('.field-label');
                if (label) {
                    const labelId = `label-${field.name || field.id || Math.random().toString(36).substr(2, 9)}`;
                    label.id = labelId;
                    field.setAttribute('aria-labelledby', labelId);
                }
            }
        });
    }

    setupLiveRegions() {
        // Create live regions for announcements
        if (!document.querySelector('[aria-live="polite"]')) {
            const politeRegion = document.createElement('div');
            politeRegion.setAttribute('aria-live', 'polite');
            politeRegion.setAttribute('aria-atomic', 'true');
            politeRegion.className = 'sr-only';
            politeRegion.id = 'polite-announcements';
            document.body.appendChild(politeRegion);
        }

        if (!document.querySelector('[aria-live="assertive"]')) {
            const assertiveRegion = document.createElement('div');
            assertiveRegion.setAttribute('aria-live', 'assertive');
            assertiveRegion.setAttribute('aria-atomic', 'true');
            assertiveRegion.className = 'sr-only';
            assertiveRegion.id = 'assertive-announcements';
            document.body.appendChild(assertiveRegion);
        }
    }

    announce(message, priority = 'polite') {
        const region = document.getElementById(`${priority}-announcements`);
        if (region) {
            region.textContent = message;
            
            // Clear after announcement
            setTimeout(() => {
                region.textContent = '';
            }, 1000);
        }
    }

    applyPerformancePreferences() {
        const { performance } = this.preferences;
        
        document.body.classList.toggle('no-particles', !performance.enableParticles);
        document.body.classList.toggle('no-cursor', !performance.enableCursor);
        document.body.classList.toggle('no-animations', !performance.enableAnimations);

        // Dispatch custom event for components to react
        window.dispatchEvent(new CustomEvent('preferencesUpdated', {
            detail: { performance }
        }));
    }

    // THEME MANAGEMENT
    toggleTheme() {
        const newTheme = this.preferences.theme === 'light' ? 'dark' : 'light';
        this.updatePreferences({ theme: newTheme });
        return newTheme;
    }

    // ACCESSIBILITY HELPERS
    toggleHighContrast() {
        const newValue = !this.preferences.accessibility.highContrast;
        this.updatePreferences({
            accessibility: {
                ...this.preferences.accessibility,
                highContrast: newValue
            }
        });
        return newValue;
    }

    toggleLargeText() {
        const newValue = !this.preferences.accessibility.largeText;
        this.updatePreferences({
            accessibility: {
                ...this.preferences.accessibility,
                largeText: newValue
            }
        });
        return newValue;
    }

    toggleReducedMotion() {
        const newValue = !this.preferences.reducedMotion;
        this.updatePreferences({ reducedMotion: newValue });
        return newValue;
    }

    // CONSULTATION HISTORY
    async addConsultationHistory(consultationData) {
        if (!this.userProfile) {
            this.userProfile = { consultationHistory: [] };
        }

        if (!this.userProfile.consultationHistory) {
            this.userProfile.consultationHistory = [];
        }

        this.userProfile.consultationHistory.unshift({
            ...consultationData,
            date: new Date().toISOString(),
            id: Date.now().toString()
        });

        // Keep only last 10 consultations
        this.userProfile.consultationHistory = this.userProfile.consultationHistory.slice(0, 10);

        this.saveLocalProfile();
        await this.saveToFirebase();
    }

    getConsultationHistory() {
        return this.userProfile?.consultationHistory || [];
    }

    // PREFERENCES EXPORT/IMPORT
    exportPreferences() {
        return {
            preferences: this.preferences,
            user: this.userProfile,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    importPreferences(importedData) {
        if (importedData.preferences) {
            this.updatePreferences(importedData.preferences);
        }

        if (importedData.user) {
            this.setUserInfo(importedData.user);
        }

        this.announce('Preferences imported successfully');
    }

    // CLEANUP
    cleanup() {
        // Save any pending changes before cleanup
        this.saveLocalProfile();
        
        if (this.db && this.userProfile) {
            // Final sync to Firebase
            this.saveToFirebase();
        }
    }
}

// Make available globally (NO EXPORT!)
window.ProfileManager = ProfileManager;
console.log('Profile Manager class loaded');