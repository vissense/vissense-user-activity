/*! { "name": "vissense-user-activity", "version": "0.2.1", "copyright": "(c) 2015 tbk" } */!function(root, factory) {
    "use strict";
    factory(root, root.VisSense);
}(this, function(window, VisSense, undefined) {
    "use strict";
    function fireListeners(listeners, context) {
        forEach(listeners, function(listener) {
            listener.call(context || window);
        });
    }
    function UserActivity(config) {
        if (!(this instanceof UserActivity)) return new UserActivity(config);
        this._config = defaults(config, {
            inactiveAfter: 6e4,
            debounce: 100,
            events: [ "resize", "scroll", "mousemove", "mousewheel", "keydown", "mousedown", "touchstart", "touchmove" ],
            active: noop,
            inactive: noop,
            update: noop
        }), this._config.throttle = this._config.debounce, this._listeners = [], this._cancelUpdate = noop, 
        this._state = {
            changed: !0,
            active: !1,
            lastActivityTime: now(),
            started: !1
        };
        var me = this;
        this._updateState = function() {
            var formerActive = me._state.active, lastActivityTime = me.getTimeSinceLastActivity();
            VisibilityApi.isHidden() || lastActivityTime >= me._config.inactiveAfter ? me._state.active = !1 : (me._state.active = !0, 
            me._cancelUpdate(), me._cancelUpdate = defer(function() {
                me._updateState();
            }, me._config.inactiveAfter)), me._state.changed = formerActive !== me._state.active, 
            fireListeners(me._listeners, me);
        }, this._onUserActivity = function() {
            me._state.lastActivityTime = now(), me._updateState();
        }, this.onUpdate(this._config.update), this.onActive(this._config.active), this.onInactive(this._config.inactive);
    }
    var Utils = VisSense.Utils, VisibilityApi = Utils.VisibilityApi, throttle = Utils.throttle, defer = Utils.defer, defaults = Utils.defaults, forEach = Utils.forEach, isFunction = Utils.isFunction, noop = Utils.noop, now = Utils.now, Strategy = VisSense.VisMon.Strategy, remove = function(array, element) {
        var index = array.indexOf(element);
        return index > -1 ? (array.splice(index, 1), !0) : !1;
    };
    UserActivity.prototype.start = function() {
        return this._state.started ? this : (this._removeEventListeners = function(consumer, options) {
            var onUserActivity = throttle(consumer, options.throttle), removeOnVisibilityChange = VisibilityApi.onVisibilityChange(onUserActivity), events = options.events;
            return forEach(events, function(event) {
                addEventListener(event, onUserActivity, !1);
            }), function() {
                forEach(events, function(event) {
                    removeEventListener(event, onUserActivity, !1);
                }), removeOnVisibilityChange();
            };
        }(this._onUserActivity, this._config), this._state.started = !0, this._onUserActivity(), 
        this);
    }, UserActivity.prototype.stop = function() {
        return this._state.started ? (this._removeEventListeners(), this._cancelUpdate(), 
        this._state.started = !1, this) : this;
    }, UserActivity.prototype.onUpdate = function(callback) {
        if (!isFunction(callback)) return noop;
        var listener = callback.bind(undefined, this);
        this._listeners.push(listener);
        var me = this;
        return function() {
            return remove(me._listeners, listener);
        };
    }, UserActivity.prototype.onChange = function(callback) {
        return this.onUpdate(function(self) {
            self._state.changed && callback(self);
        });
    }, UserActivity.prototype.onActive = function(callback) {
        return this.onChange(function(self) {
            self._state.active && callback(self);
        });
    }, UserActivity.prototype.onInactive = function(callback) {
        return this.onChange(function(self) {
            self._state.active || callback(self);
        });
    }, UserActivity.prototype.isActive = function() {
        return !this._state.started || this._state.active;
    }, UserActivity.prototype.getTimeSinceLastActivity = function() {
        return now() - this._state.lastActivityTime;
    }, VisSense.UserActivity = UserActivity, Strategy.UserActivityStrategy = function(config) {
        this._userActivity = new UserActivity(config);
        var me = this;
        this.visibilityHook = function() {
            return me._userActivity.isActive();
        };
    }, Strategy.UserActivityStrategy.prototype = Object.create(Strategy.prototype), 
    Strategy.UserActivityStrategy.prototype.init = function(monitor) {
        this.removeVisibilityHook = function(self) {
            var hooks = monitor.visobj()._config.visibilityHooks;
            return hooks.push(self.visibilityHook), function() {
                remove(hooks, self.visibilityHook);
            };
        }(this), this.removeOnChangeListener = this._userActivity.onChange(function() {
            monitor.update();
        });
    }, Strategy.UserActivityStrategy.prototype.start = function() {
        this._userActivity.start();
    }, Strategy.UserActivityStrategy.prototype.stop = function() {
        this.removeVisibilityHook(), this.removeOnChangeListener(), this._userActivity.stop();
    };
});