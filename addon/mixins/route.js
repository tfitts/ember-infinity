import Ember from 'ember';
import InfinityModel from 'ember-infinity/lib/infinity-model';
import { emberDataVersionIs } from 'ember-version-is';
const { get, set, A, computed } = Ember;
const assign = Ember.assign || Ember.merge;
/**
  The Ember Infinity Route Mixin enables an application route to load paginated
  records for the route `model` as triggered by the controller (or Infinity Loader
  component).

  @class RouteMixin
  @namespace EmberInfinity
  @module ember-infinity/mixins/route
  @extends Ember.Mixin
*/

const RouteMixin = Ember.Mixin.create({
  // these are here for backwards compat
  _infinityModel: computed('_infinityModels.[]', function() { return get(this, '_infinityModels.firstObject'); }),
  currentPage: computed.alias('_infinityModel.currentPage'),

  actions: {
    infinityLoad(infinityModel) {
      let matchingInfinityModel = this._infinityModels.find(model => model === infinityModel);
      if (matchingInfinityModel) {
        this._infinityLoad(matchingInfinityModel);
      } else {
        return true;
      }
    }
  },

  /**
   * The supported findMethod name for
   * the developers Ember Data version.
   * Provided here for backwards compat.
   * @type {String}
   * @default "query"
   */
  _storeFindMethod: 'query',

  _ensureCompatibility() {
    if (emberDataVersionIs('greaterThan', '1.0.0-beta.19.2') && emberDataVersionIs('lessThan', '1.13.4')) {
      throw new Ember.Error("Ember Infinity: You are using an unsupported version of Ember Data.  Please upgrade to at least 1.13.4 or downgrade to 1.0.0-beta.19.2");
    }

    if (Ember.isEmpty(this.get('store')) || Ember.isEmpty(this.get('store')[this._storeFindMethod])){
      throw new Ember.Error("Ember Infinity: Ember Data store is not available to infinityModel");
    }
  },

  /**
    Use the infinityModel method in the place of `this.store.find('model')` to
    initialize the Infinity Model for your route.

    @method infinityModel
    @param {String} modelName The name of the model.
    @param {Object} options Optional, the perPage and startingPage to load from.
    @param {Object} boundParams Optional, any route properties to be included as additional params.
    @return {Ember.RSVP.Promise}
  */
  infinityModel(modelName, options, boundParams) {
    if (!this._infinityModels) { this._infinityModels = A(); }

    if (emberDataVersionIs('lessThan', '1.13.0')) {
      this.set('_storeFindMethod', 'find');
    }

    if (modelName === undefined) {
      throw new Ember.Error("Ember Infinity: You must pass a Model Name to infinityModel");
    }

    this._ensureCompatibility();

    options = options ? assign({}, options) : {};

    const currentPage     = options.startingPage === undefined ? 0 : options.startingPage - 1;
    const perPage         = options.perPage || 25;
    const perPageParam    = options.perPageParam || 'per_page';
    const totalPagesParam = options.totalPagesParam || 'meta.total_pages';

    delete options.startingPage;
    delete options.perPage;
    delete options.perPageParam;
    delete options.totalPagesParam;

    const infinityModel = InfinityModel.create({
      currentPage,
      perPage,
      perPageParam,
      totalPagesParam,
      extraParams: options,
      _infinityModelName: modelName,
      content: A()
    });

    if (typeof boundParams === 'object') {
      set(infinityModel, '_boundParams', boundParams);
    }

    this._infinityModels.pushObject(infinityModel);
    return this._loadNextPage(infinityModel);
  },

  /**
   Call additional functions after finding the infinityModel in the Ember data store.
   @private
   @method _afterInfinityModel
   @param {Function} infinityModelPromise The resolved result of the Ember store find method. Passed in automatically.
   @return {Ember.RSVP.Promise}
  */
  _afterInfinityModel(_this) {
    return function(infinityModelPromiseResult, infinityModel) {
      if (typeof _this.afterInfinityModel === 'function') {
        let result = _this.afterInfinityModel(infinityModelPromiseResult, infinityModel);
        if (result) {
          return result;
        }
      }
      return infinityModelPromiseResult;
    };
  },

  /**
   Trigger a load of the next page of results.

   @private
   @method _infinityLoad
   */
  _infinityLoad(infinityModel) {
    if (get(infinityModel, '_loadingMore') || !get(infinityModel, '_canLoadMore')) {
      return;
    }

    this._loadNextPage(infinityModel);
  },

  /**
   load the next page from the adapter and update the model

   @private
   @method _loadNextPage
   @return {Ember.RSVP.Promise} A Promise that resolves the model
   */
  _loadNextPage(infinityModel) {
    set(infinityModel, '_loadingMore', true);

    const modelName = get(infinityModel, '_infinityModelName');
    const params    = infinityModel.buildParams();

    return this.get('store')[this._storeFindMethod](modelName, params)
      .then(newObjects => this._afterInfinityModel(this)(newObjects, infinityModel))
      .then(newObjects => this._doUpdate(newObjects, infinityModel))
      .then(infinityModel => {
        infinityModel.incrementProperty('currentPage');
        set(infinityModel, '_firstPageLoaded', true);

        //this._notifyInfinityModelUpdated(newObjects);
        const canLoadMore = get(infinityModel, '_canLoadMore');
        set(infinityModel, 'reachedInfinity', !get(infinityModel, '_canLoadMore'));
        if (!canLoadMore) { this._notifyInfinityModelLoaded(); }


        return infinityModel;
      }).finally(() => set(infinityModel, '_loadingMore', false));
  },


  _doUpdate(queryObject, infinityModel) {
    const totalPages = queryObject.get(get(infinityModel, 'totalPagesParam'));
    set(infinityModel, '_totalPages', totalPages);

    return infinityModel.pushObjects(queryObject.toArray());
  },

  /**
   notify that the infinity model has been updated

   @private
   @method _notifyInfinityModelUpdated
   */
  _notifyInfinityModelUpdated(newObjects) {
    if (!this.infinityModelUpdated) {
      return;
    }

    Ember.run.scheduleOnce('afterRender', this, 'infinityModelUpdated', {
      lastPageLoaded: this.get('currentPage'),
      totalPages: this.get('_totalPages'),
      newObjects: newObjects
    });
  },

  /**
   finish the loading cycle by notifying that infinity has been reached

   @private
   @method _notifyInfinityModelLoaded
   */
  _notifyInfinityModelLoaded() {
    if (!this.infinityModelLoaded) {
      return;
    }

    const totalPages = this.get('_totalPages');
    Ember.run.scheduleOnce('afterRender', this, 'infinityModelLoaded', { totalPages: totalPages });
  }
});

export default RouteMixin;
