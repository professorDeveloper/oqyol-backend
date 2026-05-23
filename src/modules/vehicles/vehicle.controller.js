import * as vehicleService from "./vehicle.service.js";
import { ok } from "../../shared/response.js";

export async function getMyVehicle(req, res) {
  const vehicle = await vehicleService.getMyVehicle(req.user.id);
  ok(res, vehicle);
}

export async function createVehicle(req, res) {
  const vehicle = await vehicleService.createVehicle({
    userId: req.user.id,
    data: req.body,
    photoFile: req.file,
  });
  ok(res, vehicle, 201);
}

export async function updateVehicle(req, res) {
  const vehicle = await vehicleService.updateVehicle({
    userId: req.user.id,
    vehicleId: req.params.id,
    data: req.body,
    photoFile: req.file,
  });
  ok(res, vehicle);
}

export async function deleteVehicle(req, res) {
  const result = await vehicleService.deleteVehicle({
    userId: req.user.id,
    vehicleId: req.params.id,
  });
  ok(res, result);
}
