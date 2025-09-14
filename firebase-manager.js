// ==========================================
// FIREBASE MANAGER - CENTRALIZED DATABASE OPERATIONS
// ==========================================

class FirebaseManager {
    constructor() {
        this.db = window.firebaseDb;
        this.analytics = window.firebaseAnalytics;
        this.userSessionId = this.generateSessionId();
        this.userDocRef = null;
        this.interactionBuffer = [];
        this.batchTimeout = null;
        this.isOnline = navigator.onLine;
        
        this.init();
    }

    init() {
        if (!this.db) {
            console.warn('Firebase not available');
            return;
        }

        // Initialize user document
        this.initializeUserSession();
        
        // Set up batching and offline handling
        this.setupBatching();
        this.setupOfflineHandling();
        
        console.log('Firebase Manager initialized with session:', this.userSessionId);
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async initializeUserSession() {
        if (!this.db) return;

        try {
            // Create or get existing user session document
            this.userDocRef = this.db.collection('user_sessions').doc(this.userSessionId);
            
            const sessionData = {
                sessionId: this.userSessionId,
                startTime: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent,
                viewport: `${window.innerWidth}x${window.innerHeight}`,
                referrer: document.referrer || 'direct',
                page: window.location.pathname,
                
                // Interaction counters (will be updated, not recreated)
                interactions: {
                    totalClicks: 0,
                    totalScrolls: 0,
                    serviceHovers: 0,
                    portfolioViews: 0,
                    formInteractions: 0,
                    testimonialViews: 0
                },
                
                // Performance data
                performance: {},
                
                // Engagement metrics
                engagement: {
                    timeOnPage: 0,
                    scrollDepth: 0,
                    pagesViewed: 1,
                    bounced: false
                },

                // Status
                status: 'active'
            };

            await this.userDocRef.set(sessionData);
            console.log('User session initialized:', this.userSessionId);
            
        } catch (error) {
            console.error('Failed to initialize user session:', error);
        }
    }

    setupBatching() {
        // Batch interactions every 10 seconds to minimize writes
        this.batchInterval = setInterval(() => {
            if (this.interactionBuffer.length > 0) {
                this.processBatchedInteractions();
            }
        }, 10000);

        // Process on page unload
        window.addEventListener('beforeunload', () => {
            this.processBatchedInteractions(true);
        });
    }

    setupOfflineHandling() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Connection restored - syncing data');
            this.processBatchedInteractions();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Connection lost - buffering interactions');
        });
    }

    // INTERACTION TRACKING (BUFFERED)
    trackInteraction(action, element, value = null, category = 'general') {
        const interaction = {
            action,
            element,
            value,
            category,
            timestamp: Date.now(),
            page: window.location.pathname
        };

        this.interactionBuffer.push(interaction);

        // Process immediately for critical actions or when buffer is full
        if (this.isCriticalAction(action) || this.interactionBuffer.length >= 20) {
            this.processBatchedInteractions();
        }
    }

    isCriticalAction(action) {
        const criticalActions = ['form_submit', 'consultation_request', 'newsletter_signup'];
        return criticalActions.includes(action);
    }

    async processBatchedInteractions(isUnload = false) {
        if (!this.db || !this.userDocRef || this.interactionBuffer.length === 0) return;

        try {
            const batch = this.db.batch();
            const interactions = [...this.interactionBuffer];
            this.interactionBuffer = [];

            // Group interactions by type for efficient updates
            const interactionCounts = this.groupInteractionCounts(interactions);
            const recentInteractions = interactions.slice(-10); // Keep last 10 for detailed tracking

            // Update user session document
            batch.update(this.userDocRef, {
                'interactions.totalClicks': firebase.firestore.FieldValue.increment(interactionCounts.clicks || 0),
                'interactions.totalScrolls': firebase.firestore.FieldValue.increment(interactionCounts.scrolls || 0),
                'interactions.serviceHovers': firebase.firestore.FieldValue.increment(interactionCounts.serviceHovers || 0),
                'interactions.portfolioViews': firebase.firestore.FieldValue.increment(interactionCounts.portfolioViews || 0),
                'interactions.formInteractions': firebase.firestore.FieldValue.increment(interactionCounts.formInteractions || 0),
                'interactions.testimonialViews': firebase.firestore.FieldValue.increment(interactionCounts.testimonialViews || 0),
                'lastActivity': firebase.firestore.FieldValue.serverTimestamp(),
                'recentInteractions': recentInteractions
            });

            if (isUnload) {
                // Use sendBeacon for unload events
                if (navigator.sendBeacon) {
                    navigator.sendBeacon('/api/track', JSON.stringify({
                        sessionId: this.userSessionId,
                        interactions: interactionCounts
                    }));
                }
            } else {
                await batch.commit();
            }

            console.log(`Processed ${interactions.length} batched interactions`);

        } catch (error) {
            console.error('Failed to process batched interactions:', error);
            // Re-add failed interactions to buffer for retry
            this.interactionBuffer.unshift(...interactions);
        }
    }

    groupInteractionCounts(interactions) {
        return interactions.reduce((counts, interaction) => {
            switch (interaction.action) {
                case 'click':
                case 'service_click':
                case 'portfolio_click':
                    counts.clicks = (counts.clicks || 0) + 1;
                    break;
                case 'scroll_depth':
                    counts.scrolls = (counts.scrolls || 0) + 1;
                    break;
                case 'service_hover':
                    counts.serviceHovers = (counts.serviceHovers || 0) + 1;
                    break;
                case 'portfolio_hover':
                case 'portfolio_view':
                    counts.portfolioViews = (counts.portfolioViews || 0) + 1;
                    break;
                case 'form_focus':
                case 'form_input':
                case 'form_validation':
                    counts.formInteractions = (counts.formInteractions || 0) + 1;
                    break;
                case 'testimonial_view':
                case 'testimonial_navigation':
                    counts.testimonialViews = (counts.testimonialViews || 0) + 1;
                    break;
            }
            return counts;
        }, {});
    }

    // FORM SUBMISSION
    async submitBookingForm(formData) {
        if (!this.db) throw new Error('Firebase not available');

        try {
            const enhancedData = this.enhanceFormData(formData);
            
            // Create booking document
            const bookingRef = await this.db.collection('bookings').add(enhancedData);
            
            // Update user session to mark as converted
            if (this.userDocRef) {
                await this.userDocRef.update({
                    'conversion': {
                        bookingId: bookingRef.id,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        serviceType: formData.serviceType,
                        budget: formData.budget,
                        leadScore: enhancedData.leadScore
                    },
                    'status': 'converted'
                });
            }

            console.log('Booking submitted successfully:', bookingRef.id);
            return bookingRef.id;

        } catch (error) {
            console.error('Booking submission failed:', error);
            throw error;
        }
    }

    enhanceFormData(formData) {
        const leadScore = this.calculateLeadScore(formData);
        const luxuryTier = this.determineLuxuryTier(formData);
        
        return {
            ...formData,
            sessionId: this.userSessionId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'new',
            source: 'luxury_website',
            leadScore: leadScore,
            priority: this.getPriority(leadScore),
            luxuryTier: luxuryTier,
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            viewport: `${window.innerWidth}x${window.innerHeight}`
        };
    }

    calculateLeadScore(formData) {
        let score = 0;
        
        const serviceScores = {
            'bespoke-design': 35,
            'comprehensive-estate': 40,
            'luxury-hardscaping': 30,
            'botanical-curation': 25,
            'master-arboriculture': 20,
            'smart-irrigation': 15,
            'estate-maintenance': 10
        };
        score += serviceScores[formData.serviceType] || 0;
        
        const budgetScores = {
            'over-1m': 40,
            '500k-1m': 35,
            '250k-500k': 25,
            '100k-250k': 15,
            '50k-100k': 5
        };
        score += budgetScores[formData.budget] || 0;
        
        if (formData.propertySize) {
            const sizeStr = formData.propertySize.toLowerCase();
            if (sizeStr.includes('acre')) {
                const acres = parseFloat(sizeStr);
                if (acres >= 5) score += 20;
                else if (acres >= 2) score += 15;
                else if (acres >= 1) score += 10;
            }
        }
        
        if (formData.projectDescription && formData.projectDescription.length > 150) {
            score += 15;
        }
        
        return Math.min(score, 100);
    }

    determineLuxuryTier(formData) {
        const budget = formData.budget;
        if (budget === 'over-1m') return 'platinum';
        if (['500k-1m', '250k-500k'].includes(budget)) return 'gold';
        if (budget === '100k-250k') return 'silver';
        return 'bronze';
    }

    getPriority(leadScore) {
        if (leadScore >= 80) return 'premium';
        if (leadScore >= 60) return 'high';
        if (leadScore >= 40) return 'medium';
        return 'standard';
    }

    // NEWSLETTER SUBSCRIPTION
    async subscribeToNewsletter(email) {
        if (!this.db) return;

        try {
            // Check if email already exists
            const existingSubscriber = await this.db.collection('newsletter_subscribers')
                .where('email', '==', email)
                .limit(1)
                .get();

            if (existingSubscriber.empty) {
                // Add new subscriber
                await this.db.collection('newsletter_subscribers').add({
                    email: email,
                    sessionId: this.userSessionId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    source: 'luxury_booking_form',
                    status: 'active'
                });
            } else {
                // Update existing subscriber
                const doc = existingSubscriber.docs[0];
                await doc.ref.update({
                    lastSubscription: firebase.firestore.FieldValue.serverTimestamp(),
                    sessionId: this.userSessionId,
                    status: 'active'
                });
            }

        } catch (error) {
            console.error('Newsletter subscription error:', error);
        }
    }

    // PERFORMANCE TRACKING
    async trackPerformanceMetrics(perfData) {
        if (!this.db || !this.userDocRef) return;

        try {
            await this.userDocRef.update({
                'performance': {
                    loadTime: perfData.loadTime,
                    domContentLoaded: perfData.domContentLoaded,
                    timeToFirstByte: perfData.timeToFirstByte,
                    connectionType: navigator.connection?.effectiveType || 'unknown',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }
            });

        } catch (error) {
            console.error('Performance tracking error:', error);
        }
    }

    // ENGAGEMENT TRACKING
    async updateEngagementMetrics(metrics) {
        if (!this.db || !this.userDocRef) return;

        try {
            await this.userDocRef.update({
                'engagement.timeOnPage': metrics.timeEngaged,
                'engagement.scrollDepth': metrics.maxScrollDepth,
                'engagement.bounced': metrics.timeEngaged < 30, // Less than 30 seconds
                'lastActivity': firebase.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            console.error('Engagement tracking error:', error);
        }
    }

    // CLEANUP
    cleanup() {
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
        }
        
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        // Process any remaining interactions
        this.processBatchedInteractions(true);
    }

    // SESSION MANAGEMENT
    async endSession() {
        if (!this.db || !this.userDocRef) return;

        try {
            await this.userDocRef.update({
                'endTime': firebase.firestore.FieldValue.serverTimestamp(),
                'status': 'ended'
            });

        } catch (error) {
            console.error('Session end error:', error);
        }
    }
}

// Export for use in other modules
export default FirebaseManager;