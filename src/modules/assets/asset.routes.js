const express = require("express");

const assetController = require("./asset.controller");

const {
  assetQuerySchema,
  createAssetSchema,
  updateAssetSchema,
  updateAssetStatusSchema,
} = require("./asset.schema");

const authenticate = require("../../middlewares/authenticate");
const authorize = require("../../middlewares/authorize");
const validate = require("../../middlewares/validate");
const validateQuery = require("../../middlewares/validateQuery");

const { USER_ROLES } = require("../../constants/roles");

const router = express.Router();

// Todo el módulo requiere autenticación.
router.use(authenticate);

// Los tres roles pueden consultar el inventario.
router.get("/", validateQuery(assetQuerySchema), assetController.getAssets);

router.get("/:id", assetController.getAssetById);

// ADMIN y ANALYST pueden registrar activos.
router.post(
  "/",
  authorize(USER_ROLES.ADMIN, USER_ROLES.ANALYST),
  validate(createAssetSchema),
  assetController.createAsset,
);

// Solo ADMIN puede modificar el ciclo de vida.
router.patch(
  "/:id/status",
  authorize(USER_ROLES.ADMIN),
  validate(updateAssetStatusSchema),
  assetController.updateAssetStatus,
);

// ADMIN y ANALYST pueden editar los datos permitidos.
router.patch(
  "/:id",
  authorize(USER_ROLES.ADMIN, USER_ROLES.ANALYST),
  validate(updateAssetSchema),
  assetController.updateAsset,
);

module.exports = router;
