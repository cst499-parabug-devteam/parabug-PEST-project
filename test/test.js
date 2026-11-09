const request = require('supertest');
const app = require('../app');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const renderPdf = require('../lib/pdf-renderer');

describe('App', function() {
  it('has the default page', function(done) {
    request(app)
      .get('/')
      .expect(/Parabug Estimate Solution Tool/, done);
  });

  it('serves the installed JSTS browser bundle', function(done) {
    request(app)
      .get('/vendor/jsts/jsts.min.js')
      .expect(200, done);
  });

  it('uses the geometry library to reject a self-intersecting application area', async function() {
    const response = await request(app)
      .post('/')
      .send({
        appArea: {
          ApplicationArea: [{
            shell: [
              { lat: 0, lng: 0 },
              { lat: 1, lng: 1 },
              { lat: 0, lng: 1 },
              { lat: 1, lng: 0 },
              { lat: 0, lng: 0 }
            ],
            holes: []
          }],
          Hazards: [],
          VariableRateAreas: []
        }
      });

    assert.equal(response.text, 'App area was not simple');
  });

  it('renders HTML into a PDF file', async function() {
    this.timeout(30000);
    const outputPath = path.join(os.tmpdir(), `parabug-${process.pid}.pdf`);

    try {
      await renderPdf('<!doctype html><html><body>Estimate</body></html>', outputPath);
      const pdf = await fs.readFile(outputPath);
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    } finally {
      await fs.rm(outputPath, { force: true });
    }
  });
}); 
