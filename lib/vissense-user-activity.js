/*global VisSense:true*/
'use strict';

var Utils = VisSense.Utils;
var throttle = Utils.throttle;
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
    throttle: 100, //ms
    events: [
      'resize', 'scroll',
      'mousemove', 'mousewheel',
      'keydown', 'mousedown',
      'touchstart', 'touchmove'
    ],
    active: noop,
    inactive: noop,
    update: noop,
    referenceWindow: window
  });

  this._listeners = [];
  this._cancelUpdate = noop;

  this._state = {
    changed: true,
    active: false,
    lastActivityTime: now(),
    started: false
  };

  this._visibilityApi = Utils.createVisibilityApi(this._config.referenceWindow);

  var me = this;
  this._updateState = function () {
    console.debug('Updating state');
    var formerActive = me._state.active;
    var lastActivityTime = me.getTimeSinceLastActivity();
    if (me._visibilityApi.isHidden() || lastActivityTime >= me._config.inactiveAfter) {
      me._state.active = false;
      console.debug('User is considered inactive.');
    } else {
      me._state.active = true;

      console.debug('Limit not reached:', lastActivityTime, '>=', me._config.inactiveAfter);

      me._cancelUpdate();

      console.debug('Cancelled timeout and reschedule again.');

      me._cancelUpdate = defer(function () {
        console.debug('Timeout executed.');
        me._updateState();
      }, me._config.inactiveAfter);
    }
    me._state.changed = formerActive !== me._state.active;

    fireListeners(me._listeners, me);
  };

  this._onUserActivity = function () {
    me._state.lastActivityTime = now();

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

  this._removeEventListeners = (function addEventListeners(VisibilityApi, consumer, options) {
    var win = options.referenceWindow;
    var onUserActivity = throttle(consumer, options.throttle);

    var removeOnVisibilityChange = VisibilityApi.onVisibilityChange(onUserActivity);
    var events = options.events;
    forEach(events, function (event) {
      win.addEventListener(event, onUserActivity, false);
    });

    return function () {
      forEach(events, function (event) {
        win.removeEventListener(event, onUserActivity, false);
      });
      removeOnVisibilityChange();
    };
  })(this._visibilityApi, this._onUserActivity, this._config);

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
  this._cancelUpdate();

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

UserActivity.prototype.onChange = function (callback) {
  return this.onUpdate(function (self) {
    if (self._state.changed) {
      callback(self);
    }
  });
};


UserActivity.prototype.onActive = function (callback) {
  return this.onChange(function (self) {
    if (self._state.active) {
      console.debug('Calling onActive listener');
      callback(self);
    }
  });
};

UserActivity.prototype.onInactive = function (callback) {
  return this.onChange(function (self) {
    if (!self._state.active) {
      console.debug('Calling onInactive listener');
      callback(self);
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
  this._visibilityHook = function () {
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
 *
 * @description
 *
 * This method adds a visibility hook which reports element
 * as hidden when the user is idle. Also, the element is updated
 * when the user becomes idle or active.
 */
Strategy.UserActivityStrategy.prototype.init = function (monitor) {
  this._removeVisibilityHook = (function (self) {
    var hooks = monitor.visobj()._config.visibilityHooks;
    hooks.push(self._visibilityHook);
    return function () {
      remove(hooks, self._visibilityHook);
    };
  })(this);

  this._removeOnChangeListener = this._userActivity.onChange(function () {
    monitor.update();
  });
};

/**
 * @method
 * @name start
 *
 * @param {VisSense.VisMon} monitor
 *
 * @memberof VisSense.VisMon.Strategy.UserActivityStrategy#
 *
 * @description
 * Starts the user-activity monitor.
 */
Strategy.UserActivityStrategy.prototype.start = function () {
  this._userActivity.start();
};

/**
 * @method
 * @name stops
 *
 * @param {VisSense.VisMon} monitor
 *
 * @memberof VisSense.VisMon.Strategy.UserActivityStrategy#
 *
 * @description
 * Stops the user-activity monitor and removes all
 * listeners and hooks.
 */
Strategy.UserActivityStrategy.prototype.stop = function () {
  this._removeVisibilityHook();
  this._removeOnChangeListener();
  this._userActivity.stop();
};













