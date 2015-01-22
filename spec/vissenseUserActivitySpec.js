/*global $,VisSense,describe,it,expect,jasmine,beforeEach,spyOn,afterEach*/
/**
 * @license
 * Vissense <http://vissense.com/>
 * Copyright 2014 tbk <theborakompanioni+vissense@gmail.com>
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */
describe('VisSense.UserActivity', function () {
  'use strict';

  function fireScrollEvent() {
    var event = document.createEvent('Event');
    event.initEvent('scroll', true, true);
    window.dispatchEvent(event);
  }

  var visobj, observer;

  beforeEach(function () {
    jasmine.getFixtures().set('<div id="element" style="width: 1px; height: 1px;"></div>');
    visobj = new VisSense($('#element')[0]);

    observer = {callback: VisSense.Utils.noop};
    spyOn(observer, 'callback');

    jasmine.clock().install();

    jasmine.clock().mockDate();
  });

  afterEach(function () {
    jasmine.clock().uninstall();
  });

  it('should construct an UserActivity object', function () {
    var activityHelper = VisSense.UserActivity();
    expect(activityHelper).toBeDefined();
  });

  it('should verify that a user is initially considered active', function () {
    var activityHelper = VisSense.UserActivity();

    expect(activityHelper._state.started).toBe(false);
    expect(activityHelper.isActive()).toBe(true);

    activityHelper.start();

    expect(activityHelper._state.started).toBe(true);
    expect(activityHelper.isActive()).toBe(true);

    activityHelper.stop();

    expect(activityHelper._state.started).toBe(false);
    expect(activityHelper.isActive()).toBe(true);
  });

  it('should verify a reasonable default configuration values', function () {
    var activityHelper = VisSense.UserActivity().start();

    expect(activityHelper.isActive()).toBe(true);

    jasmine.clock().tick(60 * 10000 + 1);

    expect(activityHelper.isActive()).toBe(false);

    activityHelper.stop();

    expect(activityHelper.isActive()).toBe(true);
  });

  it('should verify that timer will be reset on User Activity events', function () {
    var activityHelper = VisSense.UserActivity({
      inactiveAfter: 1000,
      debounce: 0
    }).start();

    expect(activityHelper.isActive()).toBe(true);

    jasmine.clock().tick(1001);

    expect(activityHelper.isActive()).toBe(false);

    fireScrollEvent();

    // let time elapse since user events are debounced
    jasmine.clock().tick(1);

    expect(activityHelper.isActive()).toBe(true);

    activityHelper.stop();
  });

  it('should verify that `inactive` event is fired correctly', function () {
    var activityHelper = VisSense.UserActivity({
      inactiveAfter: 1000,
      debounce: 0
    }).start();

    activityHelper.onInactive(observer.callback);

    expect(observer.callback.calls.count()).toEqual(0);

    jasmine.clock().tick(1001);

    expect(observer.callback.calls.count()).toEqual(1);

    activityHelper.stop();
  });

  it('should verify that `active` event is fired correctly', function () {
    var activityHelper = VisSense.UserActivity({
      inactiveAfter: 1000,
      debounce: 0
    }).start();

    activityHelper.onActive(observer.callback);

    expect(observer.callback.calls.count()).toEqual(0);

    jasmine.clock().tick(1001);

    expect(activityHelper.isActive()).toBe(false);

    fireScrollEvent();
    console.log('----------------- after firing event');
    jasmine.clock().tick(1);
    console.log('----------------- after tick');

    expect(activityHelper.isActive()).toBe(true);

    expect(observer.callback.calls.count()).toEqual(1);

    activityHelper.stop();
  });

});
