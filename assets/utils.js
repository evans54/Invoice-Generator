// Utility functions for performance optimization

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for scroll events
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Cache DOM elements to avoid repeated queries
const domCache = {
    elements: {},
    
    get(id) {
        if (!this.elements[id]) {
            this.elements[id] = document.getElementById(id);
        }
        return this.elements[id];
    },
    
    clear() {
        this.elements = {};
    }
};

// Optimized localStorage operations with error handling
const storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`Error removing localStorage key "${key}":`, error);
            return false;
        }
    }
};

// Performance monitoring
const performance = {
    startTime: null,
    
    start(label) {
        this.startTime = performance.now();
        console.log(`⏱️ ${label} started`);
    },
    
    end(label) {
        if (this.startTime) {
            const duration = performance.now() - this.startTime;
            console.log(`⏱️ ${label} completed in ${duration.toFixed(2)}ms`);
            this.startTime = null;
        }
    },
    
    measure(func, label) {
        this.start(label);
        const result = func();
        this.end(label);
        return result;
    }
};

export { debounce, throttle, domCache, storage, performance };
