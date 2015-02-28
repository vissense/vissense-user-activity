/*! { "name": "vissense-user-activity", "version": "0.0.0", "copyright": "(c) 2015 tbk" } */!function(root, factory) {
    "use strict";
    factory(root, root.VisSense);
}(this, function(window, VisSense, undefined) {
    "use strict";
    function fireListeners(listeners, context) {
        Utils.forEach(listeners, function(listener) {
            listener.call(context || window);
        });
    }
    function UserActivity(config) {
        if (!(this instanceof UserActivity)) return new UserActivity(config);
        this._config = defaults(config, {
            inactiveAfter: 6e4,
            debounce: 100,
            events: [ "resize", "scroll", "mousemove", "mousewheel", "keydown", "mousedown", "touchstart", "touchmove" ]
        }), this._listeners = [], this._clearTimeout = noop, this._state = {
            active: !0,
            changed: !1,
            lastActivityTime: now(),
            started: !1
        }, this._setActive = function(active) {
            this._state.changed = this._state.active !== active, this._state.active = active;
        };
        var me = this;
        this._updateState = function() {
            var lastActivityTime = me.getTimeSinceLastActivity();
            lastActivityTime >= me._config.inactiveAfter ? me._setActive(!1) : (me._clearTimeout(), 
            me._clearTimeout = function(callback, timeout) {
                var timeoutId = setTimeout(callback, timeout);
                return function() {
                    clearTimeout(timeoutId);
                };
            }(function() {
                me._updateState();
            }, me._config.inactiveAfter)), fireListeners(me._listeners, me);
        }, this._onUserActivity = function() {
            me._state.lastActivityTime = now(), me._setActive(!0), me._updateState();
        };
    }
    var Utils = VisSense.Utils, debounce = Utils.debounce, defaults = Utils.defaults, isFunction = Utils.isFunction, noop = Utils.noop, now = Utils.now, Strategy = VisSense.VisMon.Strategy, remove = function(array, element) {
        var index = array.indexOf(element);
        return index > -1 ? (array.splice(index, 1), !0) : !1;
    };
    UserActivity.prototype.start = function() {
        if (this._state.started) return this;
        var me = this;
        return this._removeEventListeners = function() {
            var onUserActivity = debounce(me._onUserActivity, me._config.debounce), events = me._config.events;
            return Utils.forEach(events, function(event) {
                addEventListener(event, onUserActivity, !1);
            }), function() {
                Utils.forEach(events, function(event) {
                    removeEventListener(event, onUserActivity, !1);
                });
            };
        }(), this._state.started = !0, this._onUserActivity(), this;
    }, UserActivity.prototype.stop = function() {
        return this._state.started ? (this._removeEventListeners(), this._clearTimeout(), 
        this._state.started = !1, this) : this;
    }, UserActivity.prototype.onUpdate = function(callback) {
        if (!isFunction(callback)) return noop;
        var listener = callback.bind(undefined, this);
        this._listeners.push(listener);
        var me = this;
        return function() {
            return remove(me.listeners, listener);
        };
    }, UserActivity.prototype.onActive = function(callback) {
        var me = this;
        return this.onUpdate(function() {
            me._state.changed && me._state.active && callback(me);
        });
    }, UserActivity.prototype.onInactive = function(callback) {
        var me = this;
        return this.onUpdate(function() {
            me._state.changed && !me._state.active && callback(me);
        });
    }, UserActivity.prototype.isActive = function() {
        return !this._state.started || this._state.active;
    }, UserActivity.prototype.getTimeSinceLastActivity = function() {
        return now() - this._state.lastActivityTime;
    }, VisSense.UserActivity = UserActivity, Strategy.UserActivityStrategy = function(config) {
        this._userActivity = new UserActivity(config), this.visibilityHook = function() {
            return this._userActivity.isActive();
        };
    }, Strategy.UserActivityStrategy.prototype = Object.create(Strategy.prototype), 
    Strategy.UserActivityStrategy.prototype.init = function(monitor) {
        this.removeVisibilityHook = function(self) {
            var hooks = monitor.visobj()._config.visibilityHooks;
            return hooks.push(self.visibilityHook), function() {
                remove(hooks, self.visibilityHook);
            };
        }(this);
    }, Strategy.UserActivityStrategy.prototype.start = function() {
        this._userActivity.start();
    }, Strategy.UserActivityStrategy.prototype.stop = function() {
        this.removeVisibilityHook(), this._userActivity.stop();
    };
});