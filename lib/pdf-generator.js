const path = require('node:path');
const pdfmake = require('pdfmake');

const packageDirectory = path.resolve(path.dirname(require.resolve('pdfmake')), '..');
const fontDirectory = path.join(packageDirectory, 'fonts', 'Roboto');
const logoDirectory = path.resolve(__dirname, '..', 'public', 'img');
const allowedDirectories = [fontDirectory, logoDirectory];

pdfmake.setFonts({
  Roboto: {
    normal: path.join(fontDirectory, 'Roboto-Regular.ttf'),
    bold: path.join(fontDirectory, 'Roboto-Medium.ttf'),
    italics: path.join(fontDirectory, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontDirectory, 'Roboto-MediumItalic.ttf')
  }
});
pdfmake.setUrlAccessPolicy(function() {
  return false;
});

pdfmake.setLocalAccessPolicy(function(filePath) {
  const resolvedPath = path.resolve(filePath);
  return allowedDirectories.some(function(directory) {
    return resolvedPath === directory || resolvedPath.startsWith(directory + path.sep);
  });
});

module.exports = async function writePdf(documentDefinition, outputPath) {
  await pdfmake.createPdf(documentDefinition).write(outputPath);
};