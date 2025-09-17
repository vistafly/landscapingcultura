// ==========================================
// FIXED FIREBASE MANAGER - PERMISSIONS RESOLVED
// ==========================================

class FirebaseManager {
    constructor() {
        this.db = null;
        this.analytics = null;
        this.userSessionId = this.generateSessionId();
        this.userDocRef = null;
        this.interactionBuffer = [];
        this.isOnline = navigator.onLine;
        this.isInitialized = false;
        this.sessionStartTime = Date.now();
        
        this.init();
    }

    async init() {
        let attempts = 0;
        while (!this.isInitialized && attempts < 15) {
            if (window.firebaseDb && typeof firebase !== 'undefined') {
                this.db = window.firebaseDb;
                this.analytics = window.firebaseAnalytics;
                this.isInitialized = true;
                
                try {
                    await this.initializeUserSession();
                    this.setupBatching();
                    this.setupOfflineHandling();
                    console.log('Analytics initialized:', this.userSessionId.slice(-8));
                    
                    // Test connection immediately
                    await this.testConnection();
                } catch (error) {
                }
                break;
            }
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        if (!this.isInitialized) {
            console.warn('Analytics unavailable - continuing in offline mode');
        }
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async initializeUserSession() {
        if (!this.db) return;

        try {
            this.userDocRef = this.db.collection('user_sessions').doc(this.userSessionId);
            
            const sessionData = {
                sessionId: this.userSessionId,
                startTime: firebase.firestore.FieldValue.serverTimestamp(),
                source: this.getTrafficSource(),
                device: this.getDeviceInfo(),
                location: this.getLocationInfo(),
                interactions: {
                    serviceViews: 0,
                    portfolioViews: 0,
                    formEngagement: 0,
                    callToActionClicks: 0
                },
                engagement: {
                    timeSpent: 0,
                    pagesDeep: 1,
                    scrollDepth: 0,
                    qualityScore: 0
                },
                status: 'active'
            };

            await this.userDocRef.set(sessionData);
            
        } catch (error) {
            console.error('Session init failed:', error.message);
        }
    }

    // BUSINESS ANALYTICS TRACKING
    trackBusinessEvent(event, details = {}) {
        if (!this.isInitialized) return;
        
        const businessEvent = {
            event,
            details,
            timestamp: Date.now(),
            sessionTime: Date.now() - this.sessionStartTime
        };

        if (this.isBusinessCriticalEvent(event)) {
            console.log('Business Event:', event, details);
        }

        this.interactionBuffer.push(businessEvent);

        if (this.isCriticalEvent(event) || this.interactionBuffer.length >= 8) {
            this.processBatch();
        }
    }

    isBusinessCriticalEvent(event) {
        const criticalEvents = [
            'form_submission', 'consultation_request', 'phone_call_intent',
            'high_value_service_interest', 'qualified_lead', 'conversion'
        ];
        return criticalEvents.includes(event);
    }

    isCriticalEvent(event) {
        const criticalEvents = [
            'form_submission', 'consultation_request', 'phone_call_intent'
        ];
        return criticalEvents.includes(event);
    }

    async processBatch() {
        if (!this.db || !this.userDocRef || this.interactionBuffer.length === 0) return;

        try {
            const events = [...this.interactionBuffer];
            this.interactionBuffer = [];

            const businessMetrics = this.calculateBusinessMetrics(events);
            
            await this.userDocRef.update({
                'interactions.serviceViews': firebase.firestore.FieldValue.increment(businessMetrics.serviceViews || 0),
                'interactions.portfolioViews': firebase.firestore.FieldValue.increment(businessMetrics.portfolioViews || 0),
                'interactions.formEngagement': firebase.firestore.FieldValue.increment(businessMetrics.formEngagement || 0),
                'interactions.callToActionClicks': firebase.firestore.FieldValue.increment(businessMetrics.callToActionClicks || 0),
                'engagement.timeSpent': Math.round((Date.now() - this.sessionStartTime) / 1000),
                'engagement.scrollDepth': businessMetrics.maxScrollDepth || 0,
                'engagement.qualityScore': this.calculateQualityScore(businessMetrics),
                'lastActivity': firebase.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            console.error('Analytics batch failed:', error.message);
            this.interactionBuffer.unshift(...events);
        }
    }

    calculateBusinessMetrics(events) {
        return events.reduce((metrics, event) => {
            switch (event.event) {
                case 'service_interest':
                    metrics.serviceViews = (metrics.serviceViews || 0) + 1;
                    break;
                case 'portfolio_engagement':
                    metrics.portfolioViews = (metrics.portfolioViews || 0) + 1;
                    break;
                case 'form_interaction':
                    metrics.formEngagement = (metrics.formEngagement || 0) + 1;
                    break;
                case 'cta_click':
                    metrics.callToActionClicks = (metrics.callToActionClicks || 0) + 1;
                    break;
                case 'scroll_milestone':
                    metrics.maxScrollDepth = Math.max(metrics.maxScrollDepth || 0, event.details.depth || 0);
                    break;
            }
            return metrics;
        }, {});
    }

    calculateQualityScore(metrics) {
        let score = 0;
        
        const timeSpent = (Date.now() - this.sessionStartTime) / 1000;
        if (timeSpent > 300) score += 30;
        else if (timeSpent > 120) score += 20;
        else if (timeSpent > 60) score += 10;
        
        score += Math.min((metrics.serviceViews || 0) * 10, 30);
        score += Math.min((metrics.portfolioViews || 0) * 5, 20);
        score += Math.min((metrics.formEngagement || 0) * 15, 30);
        
        if (metrics.maxScrollDepth >= 75) score += 10;
        else if (metrics.maxScrollDepth >= 50) score += 5;
        
        return Math.min(score, 100);
    }

    // FORM SUBMISSION - FIXED DATA STRUCTURE
   async submitConsultationForm(formData) {
    if (!this.db) throw new Error('Database unavailable');

    console.log('Submitting consultation form...');

    try {
        // FIXED: Simplified data structure that matches the rules
        const consultationData = {
            // Contact Information (required by rules)
            contact: {
                firstName: String(formData.firstName || ''),
                lastName: String(formData.lastName || ''),
                email: String(formData.email || ''),
                phone: String(formData.phone || ''),
                address: String(formData.address || '')
            },
            
            // Project Details
            project: {
                serviceType: String(formData.serviceType || ''),
                budget: String(formData.budget || ''),
                propertySize: String(formData.propertySize || ''),
                preferredDate: String(formData.preferredDate || ''),
                description: String(formData.projectDescription || '')
            },
            
            // Marketing Data
            marketing: {
                source: this.getTrafficSource(),
                sessionId: this.userSessionId,
                landingPage: window.location.pathname,
                referrer: document.referrer || 'direct',
                deviceType: this.getDeviceInfo().type,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            },
            
            // Lead Scoring
            leadData: {
                score: this.calculateLeadScore(formData),
                priority: this.getLeadPriority(formData),
                estimatedValue: this.estimateProjectValue(formData),
                urgency: this.assessUrgency(formData)
            },
            
            // Status Tracking
            status: {
                current: 'new',
                contacted: false,
                qualified: false,
                converted: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            
            // Preferences
            preferences: {
                newsletter: Boolean(formData.newsletter),
                contactMethod: 'email',
                bestTimeToCall: null
            }
        };
        
        console.log('Consultation data prepared:', consultationData);
        
        // USE SESSION ID AS DOCUMENT ID instead of auto-generating
        const consultationRef = this.db.collection('consultations').doc(this.userSessionId);
        await consultationRef.set(consultationData);
        
        // Update user session with conversion
        if (this.userDocRef) {
            await this.userDocRef.update({
                'conversion': {
                    consultationId: this.userSessionId, // Same ID as session
                    leadScore: consultationData.leadData.score,
                    estimatedValue: consultationData.leadData.estimatedValue,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                },
                'status': 'converted'
            });
        }

        console.log('Consultation submitted with session ID:', this.userSessionId);
        return this.userSessionId; // Return the session ID instead of auto-generated ID

    } catch (error) {
        console.error('Consultation submission failed:', error);
        throw error;
    }
}

    calculateLeadScore(formData) {
        let score = 0;
        
        const serviceScores = {
            'comprehensive-estate': 50,
            'bespoke-design': 45,
            'luxury-hardscaping': 40,
            'botanical-curation': 35,
            'master-arboriculture': 25,
            'smart-irrigation': 20,
            'estate-maintenance': 15
        };
        score += serviceScores[formData.serviceType] || 10;
        
        const budgetScores = {
            'over-1m': 50,
            '500k-1m': 40,
            '250k-500k': 30,
            '100k-250k': 20,
            '50k-100k': 10
        };
        score += budgetScores[formData.budget] || 5;
        
        if (formData.propertySize) {
            const sizeStr = formData.propertySize.toLowerCase();
            if (sizeStr.includes('acre')) {
                const acres = parseFloat(sizeStr);
                if (acres >= 5) score += 25;
                else if (acres >= 2) score += 15;
                else if (acres >= 1) score += 10;
            }
        }
        
        if (formData.projectDescription && formData.projectDescription.length > 200) {
            score += 15;
        }
        
        return Math.min(score, 100);
    }

    getLeadPriority(formData) {
        const score = this.calculateLeadScore(formData);
        if (score >= 80) return 'hot';
        if (score >= 60) return 'warm';
        if (score >= 40) return 'qualified';
        return 'cold';
    }

    estimateProjectValue(formData) {
        const budgetValues = {
            'over-1m': 1500000,
            '500k-1m': 750000,
            '250k-500k': 375000,
            '100k-250k': 175000,
            '50k-100k': 75000
        };
        return budgetValues[formData.budget] || 50000;
    }

    assessUrgency(formData) {
        if (formData.preferredDate) {
            const preferredDate = new Date(formData.preferredDate);
            const now = new Date();
            const daysUntil = Math.ceil((preferredDate - now) / (1000 * 60 * 60 * 24));
            
            if (daysUntil <= 30) return 'urgent';
            if (daysUntil <= 90) return 'moderate';
            return 'flexible';
        }
        return 'unknown';
    }

    // UTILITY METHODS
    getTrafficSource() {
        const referrer = document.referrer;
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.get('utm_source')) {
            return {
                type: 'paid',
                source: urlParams.get('utm_source'),
                medium: urlParams.get('utm_medium'),
                campaign: urlParams.get('utm_campaign')
            };
        }
        
        if (!referrer) return { type: 'direct', source: 'direct' };
        
        if (referrer.includes('google')) return { type: 'organic', source: 'google' };
        if (referrer.includes('facebook')) return { type: 'social', source: 'facebook' };
        if (referrer.includes('instagram')) return { type: 'social', source: 'instagram' };
        
        return { type: 'referral', source: new URL(referrer).hostname };
    }

    getDeviceInfo() {
        const ua = navigator.userAgent;
        let type = 'desktop';
        
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
            type = 'mobile';
        } else if (/iPad|Android(?=.*Tablet)/i.test(ua)) {
            type = 'tablet';
        }
        
        return {
            type,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: ua.slice(0, 100)
        };
    }

    getLocationInfo() {
        return {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language
        };
    }

    // BUSINESS EVENT SHORTCUTS
    trackServiceInterest(serviceName) {
        this.trackBusinessEvent('service_interest', { service: serviceName });
    }

    trackPortfolioEngagement(projectName) {
        this.trackBusinessEvent('portfolio_engagement', { project: projectName });
    }

    trackFormInteraction(fieldName) {
        this.trackBusinessEvent('form_interaction', { field: fieldName });
    }

    trackCallToAction(buttonText, location) {
        this.trackBusinessEvent('cta_click', { button: buttonText, location });
    }

    trackScrollMilestone(percentage) {
        this.trackBusinessEvent('scroll_milestone', { depth: percentage });
    }

    trackPhoneIntent() {
        this.trackBusinessEvent('phone_call_intent', { method: 'click' });
    }

    // SETUP METHODS
    setupBatching() {
        this.batchInterval = setInterval(() => {
            if (this.interactionBuffer.length > 0) {
                this.processBatch();
            }
        }, 20000);

        window.addEventListener('beforeunload', () => {
            this.processBatch();
        });
    }

    setupOfflineHandling() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processBatch();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    cleanup() {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
        }
        this.processBatch();
    }
}

window.FirebaseManager = FirebaseManager;