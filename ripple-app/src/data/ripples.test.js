import test from "node:test";
import assert from "node:assert/strict";
import {
  buildComplaintPayload,
  filterRipples,
  prepareReview,
  ripples,
} from "./ripples.js";
test("search combines location and category filters without changing source data", () => {
  assert.deepEqual(
    filterRipples(ripples, "  CENTRETOWN  ", "Roads").map((r) => r.id),
    ["bank-street"],
  );
  assert.equal(
    filterRipples(ripples, "Centretown", "Transportation").length,
    0,
  );
  assert.equal(filterRipples(ripples, "", "").length, 6);
  assert.equal(ripples.length, 6);
});
test("review preserves report content and never invents an issue or location", () => {
  const draft = {
    title: "  Blocked entrance ramp  ",
    text: "  A blocked ramp outside my building.  ",
    location: "",
    category: "",
  };
  assert.deepEqual(prepareReview(draft), {
    title: "Blocked entrance ramp",
    description: "A blocked ramp outside my building.",
    location: "Not specified",
    time: "Not specified",
    category: "Other",
  });
  assert.equal(draft.text, "  A blocked ramp outside my building.  ");
});
test("explicit optional details survive preparation", () => {
  const review = prepareReview({
    title: "Bus overcrowding",
    text: "The bus is full.",
    location: " Route 7 ",
    category: "Transportation",
  });
  assert.equal(review.location, "Route 7");
  assert.equal(review.category, "Transportation");
});

test("complaint payload keeps the edited title separate from the edited description", () => {
  const review = {
    title: "  Route 7 overcrowding  ",
    description: "  Buses are full before 9 AM.  ",
    category: "Transportation",
    location: "Route 7",
    time: "Mornings",
  };
  assert.deepEqual(buildComplaintPayload(review), {
    title: "Route 7 overcrowding",
    description: "Buses are full before 9 AM.",
    category: "Transportation",
    force_submit: false,
  });
});
test("complaint payload rejects blank titles or descriptions", () => {
  assert.throws(
    () =>
      buildComplaintPayload({
        title: "  ",
        description: "Bus is full",
        category: "Transportation",
      }),
    /required/,
  );
  assert.throws(
    () =>
      buildComplaintPayload({
        title: "Bus overcrowding",
        description: "  ",
        category: "Transportation",
      }),
    /required/,
  );
});
