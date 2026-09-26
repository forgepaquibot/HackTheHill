import test from "node:test";
import assert from "node:assert/strict";
import { filterRipples, prepareReview, ripples } from "./ripples.js";
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
    text: "  A blocked ramp outside my building.  ",
    location: "",
    category: "",
  };
  assert.deepEqual(prepareReview(draft), {
    issue: "A blocked ramp outside my building.",
    location: "Not specified",
    time: "Not specified",
    category: "Other",
  });
  assert.equal(draft.text, "  A blocked ramp outside my building.  ");
});
test("explicit optional details survive preparation", () => {
  const review = prepareReview({
    text: "The bus is full.",
    location: " Route 7 ",
    category: "Transportation",
  });
  assert.equal(review.location, "Route 7");
  assert.equal(review.category, "Transportation");
});
