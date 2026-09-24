const dashboardService = require("./dashboard.service");

const asyncHandler = require("../../utils/asyncHandler");

// Devuelve los indicadores del Dashboard.
const getDashboardOverview = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardOverview(req.user);

  return res.status(200).json({
    success: true,
    data,
  });
});

module.exports = {
  getDashboardOverview,
};
