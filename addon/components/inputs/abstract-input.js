import 'bunsen-core/typedefs'

import _ from 'lodash'
import Ember from 'ember'
const {Component, Logger} = Ember
import computed, {readOnly} from 'ember-computed-decorators'
import PropTypeMixin, {PropTypes} from 'ember-prop-types'
import {getLabel, parseVariables} from 'bunsen-core/utils'
import {getCellDefaults} from 'bunsen-core/validator/defaults'

export const defaultClassNames = {
  inputWrapper: 'left-input',
  labelWrapper: 'left-label'
}

export default Component.extend(PropTypeMixin, {
  // == State Properties =======================================================

  propTypes: {
    bunsenId: PropTypes.string.isRequired,
    bunsenModel: PropTypes.object.isRequired,
    bunsenView: PropTypes.object.isRequired,
    cellConfig: PropTypes.object.isRequired,
    errorMessage: PropTypes.oneOfType([
      PropTypes.null,
      PropTypes.string
    ]),
    formDisabled: PropTypes.bool,
    label: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    registerForFormValueChanges: PropTypes.func,
    required: PropTypes.bool,
    showAllErrors: PropTypes.bool,
    value: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.bool,
      PropTypes.null,
      PropTypes.number,
      PropTypes.object,
      PropTypes.string
    ])
  },

  getDefaultProps () {
    return {
      required: false,
      showErrorMessage: false
    }
  },

  // == Computed Properties ====================================================

  @readOnly
  @computed('formDisabled', 'cellConfig')
  disabled (formDisabled, cellConfig) {
    return formDisabled || _.get(cellConfig, 'disabled')
  },

  @readOnly
  @computed('errorMessage', 'showErrorMessage', 'showAllErrors')
  renderErrorMessage (errorMessage, showErrorMessage, showAllErrors) {
    if (!showAllErrors && !showErrorMessage) {
      return null
    }

    return errorMessage
  },

  @readOnly
  @computed('renderErrorMessage')
  /**
   * Get class name for input element
   * @param {String} errorMessage - error message for input
   * @returns {String} input class name
   */
  valueClassName (errorMessage) {
    return errorMessage ? 'error' : ''
  },

  @readOnly
  @computed('cellConfig')
  /**
   * Get class name for input wrapper element
   * @param {Object} cellConfig - cell config
   * @returns {String} input wrapper element class name
   */
  inputWrapperClassName (cellConfig) {
    return _.get(cellConfig, 'classNames.value') || defaultClassNames.inputWrapper
  },

  @readOnly
  @computed('cellConfig')
  /**
   * Get class name for label wrapper element
   * @param {Object} cellConfig - cell config
   * @returns {String} label wrapper element class name
   */
  labelWrapperClassName (cellConfig) {
    return _.get(cellConfig, 'classNames.label') || defaultClassNames.labelWrapper
  },

  @readOnly
  @computed('bunsenId', 'cellConfig', 'label', 'bunsenModel')
  /**
   * Get current label text for input
   * @param {String} bunsenId - bunsen ID for input (represents path in bunsenModel)
   * @param {BunsenCell} cellConfig - view definition for input
   * @param {String} label - label
   * @param {BunsenModel} bunsenModel - bunsen model
   * @returns {String} label text
   */
  renderLabel (bunsenId, cellConfig, label, bunsenModel) {
    const config = _.defaults({}, cellConfig, getCellDefaults())
    const customLabel = label || config.label
    return getLabel(customLabel, bunsenModel, bunsenId)
  },

  @readOnly
  @computed('value', 'cellConfig')
  transformedValue (value, cellConfig) {
    if (!_.isString(value)) {
      return value
    }

    return this.applyTransforms(value, _.get(cellConfig, 'transforms.read'))
  },

  // == Functions ==============================================================

  /**
   * Apply object transform to value
   * @param {Object} value - value to transform
   * @param {Transform} transform - transform to apply
   * @returns {Object} transformed value
   */
  applyObjectTransform (value, transform) {
    const newObject = {}
    const variables = this.getTemplateVariables(value)
    Object.keys(transform.object)
      .forEach((key) => {
        newObject[key] = parseVariables(variables, transform.object[key], '', true)
      })

    return newObject
  },

  /**
   * Apply string transform to value
   * @param {String} value - value to transform
   * @param {Transform} transform - transform to apply
   * @returns {String} transformed value
   */
  applyStringTransform (value, transform) {
    const flags = (transform.global === false ? '' : 'g')

    if (transform.regex) {
      const pattern = new RegExp(transform.from, flags)
      return value.replace(pattern, transform.to)
    }

    return value.split(transform.from).join(transform.to)
  },

  /**
   * Apply transform to value
   * @param {Object|String} value - value to transform
   * @param {Transform} transform - transform to apply
   * @returns {Object|String} transformed value
   */
  applyTransform (value, transform) {
    const isObjectTransform = 'object' in transform
    const isStringTransform = 'from' in transform && 'to' in transform

    if (isObjectTransform) {
      return this.applyObjectTransform(value, transform)
    }

    if (isStringTransform) {
      return this.applyStringTransform(value, transform)
    }

    Logger.warn('Unknown transform:', transform)

    return value
  },

  /**
   * Transform a value based on a set of transforms
   * @param {Object|String} value - value to apply transforms to
   * @param {Array<Transform>} transforms - transforms to apply to value
   * @returns {Object|String} transformed value
   */
  applyTransforms (value, transforms) {
    if (!transforms || transforms.length === 0) {
      return value
    }

    return transforms.reduce(this.applyTransform.bind(this), value)
  },

  /**
   * Get variables for parsing template strings
   * @param {Object} value - value to transform
   * @returns {Object} variables
   */
  getTemplateVariables (value) {
    const id = this.get('bunsenId')
    return {id, value}
  },

  /**
   * This should be overriden by inherited inputs to convert the value to the appropriate format
   * @param {Boolean|String} data - value to parse
   * @returns {any} parsed value
   */
  parseValue (data) {
    return _.find([data.value, _.get(data, 'target.value'), data], function (value) {
      return !_.isUndefined(value)
    })
  },

  // == Events =================================================================

  init () {
    this._super(...arguments)
    try {
      this.set('hook', this.get('formHook') + '-' + this.get('bunsenId').split('.').slice(-1)[0])
    } catch (err) {
      Logger.debug(err)
    }
  },

  didRender () {
    this._super(...arguments)
    Logger.debug('AbstractInput::didRender() called')
  },

  // == Actions ================================================================

  actions: {
    /**
     * When input looses focus we want to start showing error messages
     */
    onFocusOut () {
      if (!this.get('showErrorMessage')) {
        this.set('showErrorMessage', true)
      }
    },

    /**
     * When input enters focus we want to stop showing error messages
     */
    onFocusIn () {
      if (this.get('showErrorMessage')) {
        this.set('showErrorMessage', false)
      }
    },

    /**
     * Handle user updating value
     * @param {Event} e - event data
     */
    onChange (e) {
      const bunsenId = this.get('bunsenId')
      const newValue = this.parseValue(e)
      this.getTemplateVariables(newValue)
      const transforms = this.get('cellConfig.transforms.write')
      const transformedNewValue = this.applyTransforms(newValue, transforms)
      const oldValue = this.get('value')

      if (!_.isEqual(transformedNewValue, oldValue)) {
        const onChange = this.get('onChange')
        onChange(bunsenId, transformedNewValue)
      }
    }
  }
})
