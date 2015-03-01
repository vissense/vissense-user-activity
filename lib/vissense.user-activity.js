/*global VisSense:true*/
'use strict';

var Utils = VisSense.Utils;
var debounce = Utils.debounce;
var defer = Utils.defer;
var defaults = Utils.defaults;
var forEach = Utils.forEach;
var isFunction = Utils.isFunction;
var noop = Utils.noop;
var now = Utils.now;
var Strategy = VisSense.VisMon.Strategy;

var remove = function (array, element) {
  var index = array.indexOf(element);

  if (index > -1) {
    array.splice(index, 1);
    return true;
  }

  return false;
};

function fireListeners(listeners, context) {
  forEach(listeners, function (listener) {
    listener.call(context || window);
  });
}

function UserActivity(config) {
  if (!(this instanceof UserActivity)) {
    return new UserActivity(config);
  }

  this._config = defaults(config, {
    inactiveAfter: 60 * 1000, //ms
    debounce: 100, //ms
    events: [
      'resize', 'scroll',
      'mousemove', 'mousewheel',
      'keydown', 'mousedown',
      'touchstart', 'touchmove'
    ],
    active: noop,
    inactive: noop,
    update: noop
  });

  this._config.inactiveAfter -= 1;

  this._listeners = [];
  this._clearTimeout = noop;

  this._state = {
    active: true,
    lastActivityTime: now(),
    started: false
  };

  var me = this;
  this._updateState = function () {
    console.debug('Updating state');
    var lastActivityTime = me.getTimeSinceLastActivity();
    if (lastActivityTime >= me._config.inactiveAfter) {
      me._state.active = false;
      console.debug('User is considered inactive.');
    } else {
      console.debug('Limit not reached:', lastActivityTime, '>=', me._config.inactiveAfter);

      me._clearTimeout();

      console.debug('Cancelled timeout and reschedule again.');

      me._clearTimeout = defer(function () {
        console.debug('Timeout executed.');
        me._updateState();
      }, me._config.inactiveAfter);
    }

    fireListeners(me._listeners, me);
  };

  this._onUserActivity = function () {
    me._state.lastActivityTime = now();
    me._state.active = true;

    console.debug('User is considered active.');

    me._updateState();
  };

  this.onUpdate(this._config.update);
  this.onActive(this._config.active);
  this.onInactive(this._config.inactive);
}

UserActivity.prototype.start = function () {
  if (this._state.started) {
    return this;
  }
  console.debug('Start watching for User Activities.');

  this._removeEventListeners = (function addEventListeners(consumer, options) {
    var onUserActivity = debounce(consumer, options.debounce);

    var events = options.events;
    forEach(events, function (event) {
      addEventListener(event, onUserActivity, false);
    });

    return function () {
      forEach(events, function (event) {
        removeEventListener(event, onUserActivity, false);
      });
    };
  })(this._onUserActivity, this._config);

  this._state.started = true;

  // init with fake user action
  this._onUserActivity();

  return this;
};

UserActivity.prototype.stop = function () {
  if (!this._state.started) {
    return this;
  }
  console.debug('Stop watching for User Activities.');

  this._removeEventListeners();
  this._clearTimeout();

  this._state.started = false;

  return this;
};

UserActivity.prototype.onUpdate = function (callback) {
  if (!isFunction(callback)) {
    return noop;
  }
  var listener = callback.bind(undefined, this);
  this._listeners.push(listener);

  var me = this;
  return function () {
    console.debug('Removing listener', listener);
    return remove(me._listeners, listener);
  };
};

UserActivity.prototype.onActive = function (callback) {
  var me = this;
  return this.onUpdate(function () {
    if (me._state.active) {
      console.debug('Calling onActive listener');
      callback(me);
    }
  });
};

UserActivity.prototype.onInactive = function (callback) {
  var me = this;
  return this.onUpdate(function () {
    if (!me._state.active) {
      console.debug('Calling onInactive listener');
      callback(me);
    }
  });
};

UserActivity.prototype.isActive = function () {
  return !this._state.started || this._state.active;
};

UserActivity.prototype.getTimeSinceLastActivity = function () {
  return now() - this._state.lastActivityTime;
};

VisSense.UserActivity = UserActivity;


Strategy.UserActivityStrategy = function (config) {
  this._userActivity = new UserActivity(config);
  var me = this;
  this.visibilityHook = function () {
    return me._userActivity.isActive();
  };
};


Strategy.UserActivityStrategy.prototype = Object.create(
  Strategy.prototype
);
/**
 * @method
 * @name init
 *
 * @param {VisSense.VisMon} monitor
 *
 * @memberof VisSense.VisMon.Strategy.UserActivityStrategy#
 */
Strategy.UserActivityStrategy.prototype.init = function (monitor) {
  this.removeVisibilityHook = (function (self) {
    var hooks = monitor.visobj()._config.visibilityHooks;
    hooks.push(self.visibilityHook);
    return function () {
      remove(hooks, self.visibilityHook);
    };
  })(this);

  this.removeOnUpdateListener = this._userActivity.onUpdate(function () {
    monitor.update();
  });
};

Strategy.UserActivityStrategy.prototype.start = function () {
  this._userActivity.start();
};


Strategy.UserActivityStrategy.prototype.stop = function () {
  this.removeVisibilityHook();
  this.removeOnUpdateListener();
  this._userActivity.stop();
};













