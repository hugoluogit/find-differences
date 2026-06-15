module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const results = {};

  // Test importing TS lib files from JS
  try {
    const m = require('../lib/generateDiff');
    results.generateDiffType = typeof m.generateModifiedImage;
  } catch (e) {
    results.generateDiffError = e.message;
  }

  try {
    const m = require('../lib/findDifferences');
    results.findDiffType = typeof m.findDifferences;
  } catch (e) {
    results.findDiffError = e.message;
  }

  res.status(200).json(results);
};
