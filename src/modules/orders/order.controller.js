import * as service from "./order.service.js";
import { ok } from "../../shared/response.js";

export async function createOrder(req, res) {
  ok(res, await service.createOrder(req.user.id, req.body), 201);
}

export async function listMyOrders(req, res) {
  ok(res, await service.listMyOrders(req.user.id, req.query));
}

export async function getOrder(req, res) {
  ok(res, await service.getOrder(req.params.id, req.user));
}

export async function cancelOrder(req, res) {
  ok(res, await service.cancelOrder(req.params.id, req.user, req.body.reason));
}

export async function listOpenOrders(req, res) {
  ok(res, await service.listOpenOrders(req.query));
}

export async function arrive(req, res) {
  ok(res, await service.driverArrive(req.params.id, req.user, req.body));
}

export async function found(req, res) {
  ok(res, await service.driverFound(req.params.id, req.user, req.body));
}

export async function adminForceCancel(req, res) {
  ok(res, await service.adminForceCancel(req.params.id, req.user.id, req.body.reason));
}
