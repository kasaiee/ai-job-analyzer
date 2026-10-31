import assert from 'node:assert/strict';
import test from 'node:test';
import {clampMapZoom, getMapViewBox, projectCoordinates, resolveWorkLocation, zoomMapAtPoint} from './workLocation.js';

test('should use exact work-location coordinates from a new analysis', () => {
  assert.deepEqual(resolveWorkLocation({location: 'Austin, TX', work_location_latitude: 30.27, work_location_longitude: -97.74}, {}), {
    label: 'Austin, TX', offices: [{label: 'Austin, TX', latitude: 30.27, longitude: -97.74, isApproximate: false, locationBasis: 'explicit'}],
  });
});

test('should locate legacy analyses approximately from their timezone', () => {
  const location = resolveWorkLocation({location: 'Berlin, Germany'}, {company_timezone: 'Europe/Berlin'});
  assert.deepEqual(location.offices, [{label: 'Berlin', latitude: 52.52, longitude: 13.41, isApproximate: true, locationBasis: 'mentioned-office'}]);
});

test('should pin Warsaw when saved analysis coordinates are unavailable', () => {
  const location = resolveWorkLocation(
    {
      location: 'Warsaw, Masovian Voivodeship, Poland; in-office; open to contractors based in Poland',
      work_location_latitude: null,
      work_location_longitude: null,
    },
    {company_timezone: 'Europe/Warsaw'},
  );
  assert.deepEqual(location.offices, [{label: 'Warsaw', latitude: 52.23, longitude: 21.01, isApproximate: true, locationBasis: 'mentioned-office'}]);
});

test('should find multiple legacy office cities in the saved location text', () => {
  const location = resolveWorkLocation({location: 'Offices in Philadelphia, New York, Austin, and Sofia'}, {});
  assert.deepEqual(location.offices.map(office => office.label), ['Philadelphia', 'New York', 'Austin', 'Sofia']);
  assert.ok(location.offices.every(office => office.isApproximate));
});

test('should project geographic coordinates into the SVG viewport', () => {
  assert.deepEqual(projectCoordinates({latitude: 0, longitude: 0}), {x: 476.94444444444446, y: 462});
  const dubai = projectCoordinates({latitude: 25.2, longitude: 55.27});
  assert.ok(Math.abs(dubai.x - 632.0075) < .000001);
  assert.ok(Math.abs(dubai.y - 391.3) < .000001);
});

test('should use the detected employer country rather than candidate location for remote roles', () => {
  const location = resolveWorkLocation(
    {location: 'United Arab Emirates; advertised as remote', work_location_latitude: null, work_location_longitude: null},
    {company_timezone: 'Asia/Dubai', user_timezone: 'Asia/Tehran'},
  );
  assert.deepEqual(location.offices, [{label: 'United Arab Emirates', latitude: 24.4, longitude: 54.3, isApproximate: true, locationBasis: 'country'}]);
});

test('should not interpret null or blank coordinates as confirmed zero coordinates', () => {
  const nullCoordinates = resolveWorkLocation({location: 'Remote', work_location_latitude: null, work_location_longitude: null}, {});
  const blankCoordinates = resolveWorkLocation({location: 'Remote', work_location_latitude: ' ', work_location_longitude: ''}, {});
  assert.deepEqual(nullCoordinates.offices, []);
  assert.deepEqual(blankCoordinates.offices, []);
});

test('should use employer timezone only when no employer location is detected', () => {
  const location = resolveWorkLocation(
    {location: 'Remote'},
    {company_timezone: 'Asia/Dubai', user_timezone: 'Asia/Tehran'},
  );
  assert.deepEqual(location.offices, [{label: 'Dubai timezone', latitude: 25.2, longitude: 55.27, isApproximate: true, locationBasis: 'timezone'}]);
});

test('should constrain map zoom and center the viewport around office markers', () => {
  assert.equal(clampMapZoom(0), 1);
  assert.equal(clampMapZoom(5), 4);
  assert.equal(getMapViewBox([{point: {x: 505, y: 333}}], 2), '252.5 166.5 505 333');
  assert.equal(getMapViewBox([{point: {x: 505, y: 333}}], 2, {x: 100, y: -50}), '352.5 116.5 505 333');
  assert.equal(getMapViewBox([{point: {x: 505, y: 333}}], 2, {x: 1000, y: -1000}), '505 0 505 333');
});

test('should smoothly zoom around the mouse position', () => {
  const offices = [{point: {x: 505, y: 333}}];
  const next = zoomMapAtPoint(offices, 1, {x: 0, y: 0}, {x: .75, y: .25}, -100);
  const [x, y, width, height] = getMapViewBox(offices, next.zoom, next.pan).split(' ').map(Number);

  assert.ok(next.zoom > 1 && next.zoom < 1.5);
  assert.ok(Math.abs((x + width * .75) - 757.5) < .000001);
  assert.ok(Math.abs((y + height * .25) - 166.5) < .000001);
});
