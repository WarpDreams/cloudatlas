const c = require('./aws-component')
const assert = require('assert')

describe('test aws-component', () => {
  it ('Should create aws-component object correctly and basic assembly function works', () => {
    let component = new c.AWSComponent(
      'CloudAtlasTest',
      'component'
    )
    assert.ok(component)
  })
})