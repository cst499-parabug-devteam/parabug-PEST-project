const request = require('supertest');
const app = require('../app');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const writePdf = require('../lib/pdf-generator');

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

  it('serves Terra Draw and its Google Maps adapter', async function() {
    const terraDraw = await request(app).get('/vendor/terra-draw/terra-draw.umd.js');
    const adapter = await request(app).get('/vendor/terra-draw-google-maps-adapter/terra-draw-google-maps-adapter.umd.js');

    assert.equal(terraDraw.status, 200);
    assert.equal(adapter.status, 200);
  });

  it('uses the geometry library to reject a self-intersecting application area', async function() {
    const response = await request(app)
      .post('/')
      .send({
        info: JSON.stringify({
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
        })
      });

    assert.equal(response.body.success, false);
    assert.equal(response.body.message, 'Application Area was invalid');
  });

  it('rejects unsupported ranch-map upload types', async function() {
    const response = await request(app)
      .post('/')
      .field('info', JSON.stringify({}))
      .attach('ranchMap', Buffer.from('not an image'), {
        filename: 'invalid.txt',
        contentType: 'text/plain'
      });

    assert.equal(response.body.success, false);
    assert.match(response.body.message, /Ranch map supplied was invalid/);
  });

  it('renders a PDF report with PdfMake', async function() {
    const outputPath = path.join(os.tmpdir(), `parabug-${process.pid}.pdf`);

    try {
      await writePdf({
        content: ['Estimate', { image: 'logo', width: 120 }],
        images: {
          logo: path.join(__dirname, '..', 'public', 'img', 'logo-lrg.jpg')
        }
      }, outputPath);
      const pdf = await fs.readFile(outputPath);
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    } finally {
      await fs.rm(outputPath, { force: true });
    }
  });
}); 
