import {
  moduleForComponent,
  test,
  skip
} from 'ember-qunit';

import { run } from '@ember/runloop';
import { A } from '@ember/array';
import $ from "jquery";

moduleForComponent('infinity-loader', {
  unit: true
});

test('it renders', function(assert) {
  assert.expect(2);

  let component = this.subject();
  assert.equal(component._state, 'preRender');
  this.render();
  assert.equal(component._state, 'inDOM');
});

test('it changes text property', function(assert) {
  assert.expect(2);

  let infinityModelStub = [
    {id: 1, name: 'Tomato'},
    {id: 2, name: 'Potato'}
  ];

  let component = this.subject({ infinityModel: infinityModelStub });
  this.render();

  let componentText = $.trim(component.$().text());
  assert.equal(componentText, "Loading Infinite Model...");

  run(function() {
    component.set('infinityModel.reachedInfinity', true);
  });

  componentText = $.trim(component.$().text());
  assert.equal(componentText, "Infinite Model Entirely Loaded.");
});

skip('it checks if in view after model is pushed', function(assert) {
  assert.expect(3);

  let infinityModelStub = A();
  function pushModel() {
    infinityModelStub.pushObject({});
  }

  let component = this.subject({ infinityModel: infinityModelStub });
  run(() => {
    component.set('viewportEntered', true);
  });
  component.set('_scheduleScrolledToBottom', function() {
    assert.ok(true);
  });
  this.render();

  let done = assert.async();
  let count = 3;
  let pushModelAsynchronously = () => {
    run(pushModel);
    if (!--count) {
      done();
    }
  };
  for (let i = 0; i < 3; i++) {
    setTimeout(pushModelAsynchronously);
  }
});