// qmatom.js (C) 2021 by Paul Falstad

import Split from './split.js';

var splitViews = ['#potentialView', '#atomView', "#statesView"];
var split;

var buffers, projectionMatrix, viewMatrix;

var atomProgramInfo;
var colorPlainProgramInfo;
var glCanvas;
var stoppedCheck, cubicCheck;
var dragging, dragStop;
var animating = false;
var zoom3d = .23
var sqrt12 = Math.sqrt(.5)
var nChooser, mChooser, lChooser, viewChooser;
var sampleCount;
var selectText;

var sliceChooser;
const SLICE_NONE = 0;
const SLICE_X = 1;
const SLICE_Y = 2;
const SLICE_Z = 3;
var sliceval = 0;
var sliceFaces = [];
var sliceNormal;
var selectedSlice;

var gl;
var phaseTexture;
var compiledStates;
var compiledSliced;
const pi = Math.PI;
const pi2 = pi*2;
const root2 = 1.41421356237309504880;    // sqrt(2)
const root2inv = .70710678118654752440;  // 1/sqrt(2)
const root6by4 = .61237243569579452454;  // sqrt(6)/4
const baseEnergy = .55;

var deltaV = 0
var autopilotText
var success = false
var explosion
var distScalar
var deltaTimeWithoutSpeed
var viewAnimationTimer
var zoomRate = 0
var autoZooming;

var rotating
var lastViewFrame = ""
var vertexCountWF
var explosion

var rotationMatrix = mat4.create()
var inverseRotationMatrix = mat4.create();

var states;
var stateCount;
var realBasis, n2l1xBasis, n2l1yBasis, n3l1xBasis, n3l1yBasis, n3l2xBasis, n3l2yBasis,
    n4l1xBasis, n4l1yBasis, n4l2xBasis, n4l2yBasis,
    n4l3xBasis, n4l3yBasis, n4l3CubicBasis,
    spHybridBasis, sp2HybridBasis, sp3HybridBasis;
var basisList;
var basisCount;
var phasorCount, phasors, textCount, textBoxes;
var selectedState, selectedPhasor;
var manualScale;
var changingDerivedStates;
var bestBrightness;
var userBrightMult = .0005;
var brightnessBar;

var refresh;
var time = 0

const MODE_ANGLE = 0;
const MODE_ROTATE_X = 1;
const MODE_ROTATE_Y = 2;
const MODE_ROTATE_Z = 3;
const MODE_SLICE = 5;

const VIEW_REAL = 0;
const VIEW_COMPLEX = 1;
const VIEW_COMBO_REAL = 2;
const VIEW_COMBO_COMP = 3;
const VIEW_COMBO_N2L1 = 4;
const VIEW_COMBO_N3L1 = 5;
const VIEW_COMBO_N3L2 = 6;
const VIEW_COMBO_N4L1 = 7;
const VIEW_COMBO_N4L2 = 8;
const VIEW_COMBO_N4L3 = 9;
const VIEW_COMBO_HYBRID = 10;

var mouseDown = 0, mouseX, mouseY;
var lastOrbitAngle = 50;
const siderealDay = 23.9344696

function vecLength(x) {
  return Math.hypot(x[0], x[1], x[2])
}

function roundCoef(x) {
  if (Math.abs(x-root2inv) < 1e-3)
    return "1/&radic;2";
  if (Math.abs(x+root2inv) < 1e-3)
    return "-1/&radic;2";
  if (Math.abs(x-root6by4) < 1e-3)
    return "&radic;6/4";
  if (Math.abs(x+root6by4) < 1e-3)
    return "-&radic;6/4";
  var out = Math.round(x*1000)/1000;
  if (out == 0 && x < 0)
    return "-0";
  return out;
}

function round(x) {
  var out = Math.round(x*1000)/1000;
  return out;
}

function timeString(t) {
  var str = ""
  if (t > 24) {
    str = Math.floor(t/24) + "d "
    t %= 24
  }
  str += Math.floor(t) + "h " + Math.floor((t*60) % 60) + "m " +
         Math.floor((t*3600) % 60) + "s"
  return str
}

function getById(x) {
  return document.getElementById(x);
}

function showDiv(div, x) {
  document.getElementById(div).style.display = (x) ? "block" : "none";
}

function csInRange(x, xa, xb) {
  if (xa < xb)
    return x >= xa-5 && x <= xb+5;
  return x >= xb-5 && x <= xa+5;
}

function checkSlice(x, y) {
  if (sliceChooser.selectedIndex == SLICE_NONE) {
    selectedSlice = false;
    return;
  }
  var n;
  selectedSlice = false;
  for (n = 0; n != sliceFaces.length; n++) {
    var sf = sliceFaces[n];
    var xa = sf.edgeVerts[0];
    var ya = sf.edgeVerts[1];
    var xb = sf.edgeVerts[2];
    var yb = sf.edgeVerts[3];
    if (!csInRange(x, xa, xb) || !csInRange(y, ya, yb))
      continue;

    var d;
    if (xa == xb)
      d = Math.abs(x-xa);
    else {
      // write line as y=a+bx
      var b = (yb-ya)/(xb-xa);
      var a = ya-b*xa;
                
      // solve for distance
      var d1 = y-(a+b*x);
      if (d1 < 0)
        d1 = -d1;
      d = d1/Math.sqrt(1+b*b);
    }
    if (d < 6) {
      selectedSlice = true;
      sliceNormal = sf.normal;
      break;
    }
  }
}

// map point on screen to 3-d coordinates assuming it lies on a given plane
// (pn = plane normal, pp = point in plane).  Make sure projectionMatrix
// is the correct one before calling!
function unmap3d(x3, x, y, pn, pp) {
  var invProjMatrix = mat4.create();
  mat4.invert(invProjMatrix, projectionMatrix);

  // calculate point on near plane corresponding to mouse point.
  // w value used here doesn't matter!
  var mousePos = [(x-glCanvas.width/2)/(glCanvas.width/2), -(y-glCanvas.height/2)/(glCanvas.height/2), -1, 1];

  // invert projection and view matrices so we can get this point into world coordinates
  vec4.transformMat4(mousePos, mousePos, invProjMatrix);

  // divide out w
  var i;
  for (i = 0; i != 4; i++)
    mousePos[i] /= mousePos[3];

  var invViewMatrix = mat4.create();
  mat4.invert(invViewMatrix, viewMatrix);
  var cameraPos = [0, 0, 0, 1];

  // put camera and mouse point into world coordinates
  vec4.transformMat4(cameraPos, cameraPos, invViewMatrix);
  vec4.transformMat4(mousePos, mousePos, invViewMatrix);

  // calculate direction of mouse point from camera,
  // so we can calculate line through those two points
  var mvx = (mousePos[0]-cameraPos[0]);
  var mvy = (mousePos[1]-cameraPos[1]);
  var mvz = (mousePos[2]-cameraPos[2]);

  // calculate the intersection between the line and the given plane
  var t = ((pp[0]-cameraPos[0])*pn[0] +
           (pp[1]-cameraPos[1])*pn[1] +
           (pp[2]-cameraPos[2])*pn[2]) /
            (pn[0]*mvx+pn[1]*mvy+pn[2]*mvz);

  x3[0] = cameraPos[0]+mvx*t;
  x3[1] = cameraPos[1]+mvy*t;
  x3[2] = cameraPos[2]+mvz*t;
}

function dragSlice(x, y) {
  var x3 = [];
  unmap3d(x3, x, y, sliceNormal, sliceNormal);
  switch (sliceChooser.selectedIndex) {
  case SLICE_X: sliceval = x3[0]; break;
  case SLICE_Y: sliceval = x3[1]; break;
  case SLICE_Z: sliceval = x3[2]; break;
  }
  // Avoid -1,+1 because it causes the slice to get drawn on top of/underneath the cube edges.
  if (sliceval < -.99)
    sliceval = -.99;
  if (sliceval > .99)
    sliceval = .99;
  refresh();
}

// update info text
function updateInfo(norms) {
  var info = document.getElementById("values");
  var w = glCanvas.width*getScaler()*.0529463;
  info.innerHTML = (sliceChooser.selectedIndex == SLICE_NONE) ? "Screen width = " + round(w) + " nm<br>" : "";

  if (!realCheck.checked) {
    if (!imaginaryCheck.checked)
      info.innerHTML += "Real and imaginary part both hidden<br>";
    else
      info.innerHTML += "Showing imaginary part only<br>";
  } else if (!imaginaryCheck.checked)
    info.innerHTML += "Showing real part only<br>";

  var normmult = norms.normmult;
  var first = true;
  var table = "";
  if (stoppedCheck.checked || dragging) {
    var i;
    for (i = 0; i != stateCount; i++) {
      var st = states[i];
      if (st.mag == 0)
        continue;
      table += (first) ? "<tr><td>&psi;</td><td>=</td><td>(" : "<td></td><td>+</td><td>(";
      first = false;
      if (st.re != 0 || st.im == 0)
        table += roundCoef(st.re*normmult);
      if (st.im > 0 && st.re != 0)
        table += "+";
      if (st.im != 0)
        table += roundCoef(st.im*normmult) + "i";
      table += ")\uff5c" + st.n + "," + st.l + "," + st.m + "&gt;</td></tr>";
    }
  }
  info.innerHTML += "<table>" + table + "</table><br>";
  if (normmult < .99 && !first)
    info.innerHTML += "(normalized)<br>";
}

function addFunctionMouseEvents(canvas) {
  canvas.onmousemove = function (event) {
    canvas.mouseX = event.clientX;
  }
  canvas.onmouseout = canvas.onmouseup = function (event) {
    canvas.mouseX = 0;
    refresh();
    updateStateLink();
  }
}

var lastClick;
var dragStartTime;

function addStatesMouseEvents(canvas) {
  canvas.onmousemove = function (event) {
    var rect = canvas.getBoundingClientRect();
    // reset click timer
    lastClick = dragStartTime = 0;
    if (dragging)
      editMag(event.clientX-rect.left, event.clientY-rect.top);
    else
      findPhasor(event.clientX-rect.left, event.clientY-rect.top);
  }
  canvas.onmousedown = function (event) {
    var rect = canvas.getBoundingClientRect();
    findPhasor(event.clientX-rect.left, event.clientY-rect.top);
    dragging = true;

    // for click detection
    dragStartTime = new Date().getTime();

    if (selectedState == null)
      return;
    selectedState.set(0);
  }
  canvas.onmouseup = function (event) {
    dragging = changingDerivedStates = dragStop = false;
    refresh();
    var now = new Date().getTime();
    var timeSince = now-lastClick;
    if (timeSince < 500 && timeSince > 0) {
      // doubleclick detected
      // we don't use ondblclick because that doesn't work with tap interfaces
      if (selectedState != null)
        enterSelectedState();
    }
    // click detected?
    if (now-dragStartTime < 200)
      lastClick = now;
    updateStateLink();
  }
  canvas.onmouseout = function (event) {
    dragging = changingDerivedStates = dragStop = false;
    refresh();
  }
  convertTouchEvents(canvas);
}

// used when double-clicking on a state to enter that state and clear all others
function enterSelectedState() {
  var i;
  for (i = 0; i != stateCount; i++)
    if (states[i] != selectedState)
      states[i].set(0);
  selectedState.convertBasisToDerived();
  selectedState.set(1);
  selectedState.convertDerivedToBasis();
  createOrbitals();
  refresh();
}

function findPhasor(x, y) {
  var i;
  const oldState = selectedState;
  for (i = 0; i != phasorCount; i++) {
    if (!phasors[i].inside(x, y))
      continue;
    selectedPhasor = phasors[i];
    selectedState = selectedPhasor.state;
    if (selectedState != oldState)
      refresh();
    getById("selectText").innerHTML = selectedState.getText();
    return;
  }
  selectedState = selectedPhasor = null;
  if (oldState != null)
    refresh();
  getById("selectText").innerHTML = '';
}

function editMag(x, y) {
  if (selectedPhasor == null)
    return;
  var stateSize = selectedPhasor.width;
  var ss2 = stateSize/2;
  var x0 = selectedPhasor.x + ss2;
  var y0 = selectedPhasor.y + ss2;
  x -= x0;
  y -= y0;
  var mag = Math.sqrt(x*x+y*y)/ss2;
  var ang = Math.atan2(-y, x);
  if (mag > 5)
    mag = 0;
  if (mag > 1)
    mag = 1;
  selectedState.setMagPhase(mag, ang);

  changingDerivedStates = false;
  if (selectedState instanceof DerivedState) {
    selectedState.convertDerivedToBasis();
    changingDerivedStates = true;
  }

  refresh();
  createOrbitals();
  dragStop = true;
}


const ST_CHOOSER = 1;
const ST_CHECK = 2;
const ST_SLIDER = 3;
const ST_INPUT = 4;

const stateArgs = ["vc", ST_CHOOSER, "n", ST_CHOOSER, "l", ST_CHOOSER, "m", ST_CHOOSER, "sl", ST_CHOOSER,
  "mod", ST_CHOOSER, "sc", ST_CHECK, "cub", ST_CHECK, "en", ST_CHECK, "lc", ST_CHECK,
  "rc", ST_CHECK, "pcc", ST_CHECK, "axc", ST_CHECK, "compc", ST_CHECK, "asc", ST_CHECK, "anc", ST_CHECK,
  "sp", ST_SLIDER, "sam", ST_INPUT
]

function getStateItems() {
  return [viewChooser, nChooser, lChooser, mChooser, sliceChooser, modeChooser, stoppedCheck, cubicCheck,
          energyCheck, lCheck, radialCheck, phaseColorCheck, axesCheck, componentsCheck,
          autoScaleCheck, animScaleCheck, speed, samplesInput];
}

// save state in link
function updateStateLink() {
  var link = window.location.href.split('?')[0] + "?";
  var b = getStateItems();
  var i;
  for (i = 0; i != stateArgs.length; i += 2) {
    var comp = b[i/2];
    // check if hidden (choosers only)
    if (comp.offsetParent == null && type == ST_CHOOSER)
      continue;
    var type = stateArgs[i+1];
    var val = 0;
    if (type == ST_CHOOSER)
      val = comp.selectedIndex;
    if (type == ST_CHECK)
      val = comp.checked;
    if (type == ST_SLIDER || type == ST_INPUT)
      val = comp.value;
    link += stateArgs[i] + "=" + encodeURIComponent(val) + "&";
  }

  // convert rotation matrix to Eulerian angles and save them in URL
  var thx = Math.atan2(rotationMatrix[9], rotationMatrix[10]);
  var thy = Math.atan2(-rotationMatrix[8], Math.hypot(rotationMatrix[9], rotationMatrix[10]));
  var thz = Math.atan2(rotationMatrix[4], rotationMatrix[0]);
  link += "rx=" + Math.floor(thx*180/Math.PI) + "&ry=" + Math.floor(thy*180/Math.PI) + "&rz=" + Math.floor(thz*180/Math.PI) +
          "&br=" + userBrightMult;
  if (manualScale)
    link += "&zm=" + round(zoom3d);
  if (phasorCount > 0) {
    var i;
    for (i = 0; i != stateCount; i++) {
      var st = states[i];
      if (st.mag > 0)
        link += "&st" + st.n + "," + st.l + "," + st.m + "=" + round(st.re) + "," + round(st.im);
    }
  }

  document.getElementById("stateLink").href = link;
}

function addMouseEvents(canvas) {
  canvas.onmousedown = function (event) {
    var rect = glCanvas.getBoundingClientRect();
    checkSlice(event.clientX-rect.left, event.clientY-rect.top);
    mouseDown = 1;
    mouseX = event.clientX
    mouseY = event.clientY
  }

  canvas.onmouseup = function (event) {
    mouseDown = 0;
    updateStateLink();
  }

  canvas.onmousemove = function (event) {
    var rect = glCanvas.getBoundingClientRect();
    if (mouseDown) {
      if (selectedSlice) {
        dragSlice(event.clientX-rect.left, event.clientY-rect.top);
        return;
      }
      var dx = event.clientX - mouseX
      var dy = event.clientY - mouseY
      mouseX = event.clientX
      mouseY = event.clientY

      switch (modeChooser.selectedIndex) {
      case MODE_ANGLE:
        // rotate view matrix
        var mtemp = mat4.create()
        mat4.rotate(mtemp, mtemp, dx*.01, [0, 1, 0]);
        mat4.rotate(mtemp, mtemp, dy*.01, [1, 0, 0]);
        mat4.multiply(rotationMatrix, mtemp, rotationMatrix);
        break;
      case MODE_ROTATE_X:
        rotateXY((dx+dy)/40, true);
        break;
      case MODE_ROTATE_Y:
        rotateXY((dx+dy)/40, false);
        break;
      case MODE_ROTATE_Z:
        rotateZ((dx+dy)/40);
        break;
      }
    } else {
      checkSlice(event.clientX-rect.left, event.clientY-rect.top);
    }
    refresh();
  }

  canvas.addEventListener("wheel", function (event) {
      zoom3d *= Math.exp(-event.deltaY * .001)
      zoom3d = Math.min(Math.max(zoom3d, .005), 500)
      manualScale = true;
      refresh()
      updateStateLink();
  })

  convertTouchEvents(canvas);
}

function convertTouchEvents(canvas) {
  var lastTap;

  // convert touch events to mouse events
	canvas.addEventListener("touchstart", function (e) {
      //mousePos = getTouchPos(canvas, e);
  		var touch = e.touches[0];
  		var etype = "mousedown";
  		lastTap = e.timeStamp;
  		
  		var mouseEvent = new MouseEvent(etype, {
    			clientX: touch.clientX,
    			clientY: touch.clientY
  		});
  		e.preventDefault();
  		canvas.dispatchEvent(mouseEvent);
  }, false);
  
  canvas.addEventListener("touchend", function (e) {
  		var mouseEvent = new MouseEvent("mouseup", {});
  		e.preventDefault();
  		canvas.dispatchEvent(mouseEvent);
  }, false);
  
  canvas.addEventListener("touchmove", function (e) {
  		var touch = e.touches[0];
  		var mouseEvent = new MouseEvent("mousemove", {
    			clientX: touch.clientX,
    			clientY: touch.clientY
  		});
  		e.preventDefault();
  		canvas.dispatchEvent(mouseEvent);
	}, false);

	// Get the position of a touch relative to the canvas
	function getTouchPos(canvasDom, touchEvent) {
  		var rect = canvasDom.getBoundingClientRect();
  		return {
    			x: touchEvent.touches[0].clientX - rect.left,
    			y: touchEvent.touches[0].clientY - rect.top
  		};
	}


}

function resizeCanvas(cv) {
    var width = cv.clientWidth;
    var height = cv.clientHeight;
    if (cv.width != width ||
        cv.height != height) {
       cv.width = width;
       cv.height = height;
       return true;
    }
    return false;
}

// add handlers for buttons so they work on both desktop and mobile
function handleButtonEvents(id, func, func0) {
  var button = document.getElementById(id)
  button.addEventListener("mousedown", func, false)
  button.addEventListener("touchstart", func, false)

  button.addEventListener("mouseup", func0, false)
  button.addEventListener("mouseleave", func0, false)
  button.addEventListener("touchend", func0, false)
}

// radial contribution to normalization factor
function radialNorm(n, l) {
  var a0 = factorial(n+l);
  return Math.sqrt(4.*factorial(n+l)/(n*n*n*n*factorial(n-l-1)))/factorial(2*l+1);
}

// spherical contribution to normalization factor
function sphericalNorm(l, m) {
  var q = Math.sqrt((2*l+1)*factorial(l-m)/(4*pi*factorial(l+m)));
  return q;
}

function factorial(f) {
  var res = 1;
  while (f > 1)
    res *= f--;
  return res;
}

function confluentHypergeometricFunction(a, c, z) {
  var fac = 1;
  var result = 1;
  for (var n=1;n<=1000;n++) {
    fac *= a*z/(n*c);
    if (fac == 0)
      return result;
    result += fac;
    a++;
    c++;
  }
}

function confluentHypergeometricFunctionExp(a, c) {
  var fac = 1;
  var result = "1.0";
  var fac = "1.0";
  for (var n=1;n<=1000;n++) {
    if (a == 0)
      return result;
    var m = makeFloatStr(a/(n*c));
    fac += "*" + m + "*rho";
    result += " + " + fac;
    a++;
    c++;
  }
}

function confluentHypergeometricFunctionExpForNL(n, l) {
  return confluentHypergeometricFunctionExp(l+1-n, 2*l+2);
}

// generalized binomial coefficient
function binomial(n, k) {
  var result = 1;
  var i;
  for (i = 0; i != k; i++) {
    result *= n;
    n -= 1;
  }
  return result/factorial(k);
}

// coefficients of chebyshev polynomials of the first kind
function chebyCoef(n) {
  if (n == 0)
    return [1];
  if (n == 1)
    return [0, 1];
  var t1 = chebyCoef(n-1);
  var t2 = chebyCoef(n-2);
  var tn = [];
  var i;
  for (i = 0; i <= n; i++) {
    var q = (i >= t2.length) ? 0 : -t2[i];
    if (i > 0)
      q += 2*t1[i-1];
    tn[i] = q;
  }
  return tn;
}

// coefficients of chebyshev polynomials of the second kind
function cheby2Coef(n) {
  var odd = (n % 2) == 1;
  var t = chebyCoef(n);
  n -= 2;
  while (n >= 0) {
    var t2 = chebyCoef(n);
    var i;
    for (i = 0; i != t2.length; i++)
      t[i] += t2[i];
    n -= 2;
  }
  for (i = 0; i != t.length; i++)
    t[i] *= 2;
  if (!odd)
    t[0] -= 1;
  return t;
}

// convert array of coefficients to an expression to evaluate polynomial
function getPoly(coefs, x) {
  var i;
  var res = makeFloatStr(coefs[0]);
  var parens = "";
  for (i = 1; i < coefs.length; i++) {
    if (coefs[i] == 0)
      continue;
    res += ((i == 1) ? "+" + x + "*(" : "+" + x + "*" + x + "*(") + makeFloatStr(coefs[i]);
    parens += ")";
  }
  return res + parens;
}

function makeFloatStr(x) {
  var m = x.toString();
  if (m.indexOf(".") < 0)
    m += ".0";
  return m;
}

function associatedLegendrePolynomial(l, m) {
  var k;
  var result = Math.pow(2, l) + ".0*" + evenOddPowExpr("sinth", m) + "*(0.0";
  for (k = m; k <= l; k++) {
    var c = factorial(k)/factorial(k-m);
    c *= binomial(l, k) * binomial((l+k-1)/2, l);
    if (c != 0)
      result += "+ " + makeFloatStr(c) + "*" + evenOddPowExpr("costh", k-m);
  }
  return result + ")";
}

function powExpr(x, n) {
  if (n == 0)
    return "(1.0)";
  if (n == 1)
    return "(" + x + ")";
  if (n == 2)
    return "(" + x + ")*(" + x + ")";
  return "pow(" + x + ", " + n + ".0)";
}

// same as powExpr but works if first argument is negative
function evenOddPowExpr(x, k) {
  if (k < 3)
    return powExpr(x, k);
  var pw = (k % 2 == 0) ? "evenpow" : "oddpow";
  return pw + "(" + x + ", " + k + ".0)";
}

// create texture used to convert complex numbers to phase colors
function createPhaseTexture() {
  if (!phaseColorCheck.checked) {
    createWhiteTexture();
    return;
  }
  phaseTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, phaseTexture);

  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.FLOAT;
  const level = 0;
  const width = 512;
  const height = width;
  var cols = [];
  var i, j;
  for (j = 0; j != height; j++)
    for (i = 0; i != width; i++) {
      var x = i-width/2;
      var y = j-height/2;
      var r = Math.hypot(x, y);
      if (!realCheck.checked)
        x = 0;
      if (!imaginaryCheck.checked)
        y = 0;
      var ang = Math.atan2(y, x);
      // convert to 0 .. 6
      ang *= 3/pi;
      if (ang < 0)
        ang += 6;
      var hsec = Math.floor(ang);
      var a2 = ang % 1;
      var a3 = 1.-a2;
      var val = Math.hypot(x, y)/r;
      switch (hsec) {
      case 6:
      case 0: cols.push(val, val*a2, 0, 0); break;
      case 1: cols.push(val*a3, val, 0, 0); break;
      case 2: cols.push(0, val, val*a2, 0); break;
      case -3: case 3: cols.push(0, val*a3, val, 0); break;
      case 4: cols.push(val*a2, 0, val, 0); break;
      case 5: cols.push(val, 0, val*a3, 0); break;
      default: console.log("bad hsec " + hsec);
      }
   }
  const pixel = new Float32Array(cols);
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, 0, srcFormat, srcType, pixel);
}

// create all-white texture if "phase as color" turned off
function createWhiteTexture() {
  phaseTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, phaseTexture);

  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.FLOAT;
  const level = 0;
  const width = 512;
  const height = width;
  var cols = [];
  var i, j;
  for (j = 0; j != height; j++)
    for (i = 0; i != width; i++) {
      var x = i-width/2;
      var y = j-height/2;
      var r = Math.hypot(x, y);
      if (!realCheck.checked)
        x = 0;
      if (!imaginaryCheck.checked)
        y = 0;
      var val = Math.hypot(x, y)/r;
      cols.push(val, val, val, 1);
   }
  const pixel = new Float32Array(cols);
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, 0, srcFormat, srcType, pixel);
}

// create shader to display current set of basis states.
// the states we're drawing are hard-coded in the shader, with coefficients passed in as uniforms.
// So we create a new one when the states change.
function createAtomProgram(states) {
  // Vertex shader program for non-sliced
  const vsSourceNorm = `
    attribute vec4 aVertexPosition;
    varying highp vec3 vPosition;

    void main(void) {
      gl_Position = aVertexPosition;
      vPosition = aVertexPosition.xyz;
    }
  `;

  // vertex shader program for sliced
  const vsSourceSliced = `
    attribute vec4 aVertexPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying highp vec3 vPosition;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vPosition = vec3(aVertexPosition.xy, aVertexPosition.z/aVertexPosition.w);
    }
  `;

  // start of fragment shader (sliced or non-sliced)
  var fsSourceStart = `
    varying highp vec3 vPosition;
    uniform highp float uZoom;
    uniform highp float uBrightness;
    uniform sampler2D uPhaseTexture;
    uniform highp vec2 uPhases[PHASECOUNT];

    highp float oddpow(highp float a, highp float b) {
      return (a < 0.) ? -pow(-a, b) : pow(a, b);
    }

    highp float evenpow(highp float a, highp float b) {
      return pow(abs(a), b);
    }
  `;

  // middle of fragment shader (sliced or non-sliced)
  var fsSourceMiddle = `
        highp float r = length(v.xyz);
        highp float xylen = length(vec2(v.x, v.y));
        highp float cosph = v.x/xylen;
        highp float sinph = v.y/xylen;
        highp float sinth = xylen/r;
        highp float costh = v.z/r;
        highp vec2 val = vec2(0., 0.);
        highp float rho = 0.0;
        // code to calculate orbital(s) is inserted here
CALCVAL
        highp float valr = length(val.st);
        col += vec4(texture2D(uPhaseTexture, vec2(.5, .5)+.4*val/valr).rgb, 1.0)*valr*valr;
  `;

  // end of fragment shader (sliced or non-sliced)
  var fsSourceEnd = `
      col *= uBrightness;
      col /= max(1.0, max(col.r, max(col.g, col.b)));
      gl_FragColor = col;
    }
  `;
  
  // fragment shader sliced
  var fsSourceSliced = fsSourceStart + `

    void main(void) {
      highp vec4 col = vec4(0., 0., 0., 0.);
      highp vec3 v = vPosition;
    ` + fsSourceMiddle + fsSourceEnd;

  // fragment shader non-sliced
  var fsSourceNorm = `
    uniform highp mat4 uRotationMatrix;
    uniform highp mat4 uAspectMatrix;
  ` + fsSourceStart + `

    void main(void) {
      highp vec4 col = vec4(0., 0., 0., 1.);
      highp vec4 pos = uAspectMatrix * vec4(vPosition, 1.);
      for (highp float z = -1.0; z < 1.0; z += 2./SAMPLECOUNT.) {
        highp vec4 v = uRotationMatrix * vec4(pos.xy, z, 1.);
   ` + fsSourceMiddle + '}' + fsSourceEnd;

  var i;
  var calcVal = "";
  // calculate wave function from basis functions
  var lastN = -1;
  for (i = 0; i != states.length; i++) {
    var state = states[i];
    var n = state.n;
    var l = state.l;
    // m is always positive here
    var m = state.m;
    // generate code to calculate this basis function
    calcVal += "// " + n + "," + l + ",+/-" + m + "\n";
    if (n != lastN) {
      calcVal += "rho = r*uZoom*" + makeFloatStr(1/n) + ";\n";
      lastN = n;
    }
    calcVal += "val += " + radialNorm(n, l)*sphericalNorm(l, m) + "*" + powExpr("rho", l) + "*(";
    calcVal += confluentHypergeometricFunctionExpForNL(n, l) + ")*exp(-rho/2.)*(";
    calcVal += associatedLegendrePolynomial(l, Math.abs(m)) + ")*(";

    // calculate exprs for sin(m ph), cos(m phi) from sin/cos(phi) using chebyshev polynomials,
    // to avoid doing trig in the shader
    var cb = getPoly(chebyCoef(m), "cosph");
    var sb = m == 0 ? "0.0" : "sinph*(" + getPoly(cheby2Coef(m-1), "cosph") + ")";

    // we don't use exp(+-i m phi) as basis functions, instead we use cos(phi) and sin(phi) so we only have to deal with real numbers
    calcVal += "(" + cb + ")*uPhases[" + (i*2) + "] + (" + sb + ")*uPhases[" + (i*2+1) + "]);\n";
  }
  var sliced = (sliceChooser.selectedIndex > SLICE_NONE);
  var fsSource = (sliced) ? fsSourceSliced : fsSourceNorm;
  var ss = getById("samplesInput").value;
  if (ss > 0)
    sampleCount = ss;
  fsSource = fsSource.replace("CALCVAL", calcVal);
  fsSource = fsSource.replace("PHASECOUNT", states.length*2);
  fsSource = fsSource.replace("SAMPLECOUNT", sampleCount);
  //console.log(fsSource);

  const shaderProgram = initShaderProgram(gl, sliced ? vsSourceSliced : vsSourceNorm, fsSource);

  atomProgramInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      rotationMatrix: gl.getUniformLocation(shaderProgram, 'uRotationMatrix'),
      aspectMatrix: gl.getUniformLocation(shaderProgram, 'uAspectMatrix'),
      zoom: gl.getUniformLocation(shaderProgram, 'uZoom'),
      brightness: gl.getUniformLocation(shaderProgram, 'uBrightness'),
      phaseTexture: gl.getUniformLocation(shaderProgram, 'uPhaseTexture'),
      phases: gl.getUniformLocation(shaderProgram, 'uPhases'),
    },
  };
}

// create normal shaders
function createShaders() {
  // Vertex shader program

  const vsSource = `
    attribute vec4 aVertexPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
  `;

  const fsColorNoLightingSource = `
    uniform highp vec4 uColor;

    void main(void) {
      gl_FragColor = uColor;
    }
  `;

  const colorPlainShaderProgram = initShaderProgram(gl, vsSource, fsColorNoLightingSource);

  colorPlainProgramInfo = {
    program: colorPlainShaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(colorPlainShaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(colorPlainShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(colorPlainShaderProgram, 'uModelViewMatrix'),
      color: gl.getUniformLocation(colorPlainShaderProgram, 'uColor'),
    },
  };
}

var restarting = false;

function parseArguments() {
  const urlParams = new URLSearchParams(window.location.search);
  const b = getStateItems();
  var i;
  for (i = 0; i != stateArgs.length; i += 2) {
    var obj = b[i/2];
    var type = stateArgs[i+1];
    if (!urlParams.has(stateArgs[i]))
      continue;
    if (type == ST_CHOOSER) {
      obj.selectedIndex = urlParams.get(stateArgs[i]);
      if (obj.onchange)
        obj.onchange();
    }
    if (type == ST_CHECK) {
      obj.checked = urlParams.get(stateArgs[i]) == "true";
      if (obj.onclick)
        obj.onclick();
    }
    if (type == ST_SLIDER || type == ST_INPUT) {
      obj.value = urlParams.get(stateArgs[i]);
      if (obj.oninput)
        obj.oninput();
    }
  }
  if (urlParams.has("rx")) {
    rotationMatrix = mat4.create()
    mat4.rotate(rotationMatrix, rotationMatrix, -urlParams.get("rx")*Math.PI/180, [1, 0, 0]);
    mat4.rotate(rotationMatrix, rotationMatrix, -urlParams.get("ry")*Math.PI/180, [0, 1, 0]);
    mat4.rotate(rotationMatrix, rotationMatrix, -urlParams.get("rz")*Math.PI/180, [0, 0, 1]);
  }
  if (urlParams.has("zm")) {
    zoom3d = urlParams.get("zm");
    manualScale = true;
  }
  if (urlParams.has("br"))
    userBrightMult = urlParams.get("br");
  var cleared = false;
  for (let p of urlParams) {
    if (!p[0].startsWith("st"))
      continue;
    if (!cleared) {
      doClear();
      cleared = true;
    }
    var nlm = p[0].substring(2).split(",");
    var reim = p[1].split(",");
    var st = getState(parseInt(nlm[0]), parseInt(nlm[1]), parseInt(nlm[2]));
    st.set(parseFloat(reim[0]), parseFloat(reim[1]));
  }
}

function main() {
  refresh = function () { }  // to avoid errors until we set it for real
  const canvas = glCanvas = document.querySelector('#atomCanvas');
  gl = canvas.getContext('webgl');

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }
  var float_texture_ext = gl.getExtension('OES_texture_float');

  createShaders();
  stoppedCheck = document.getElementById("stoppedCheck");
  cubicCheck = document.getElementById("cubicCheck");
  addMouseEvents(canvas)
  addStatesMouseEvents(document.getElementById("statesCanvas"));
  addFunctionMouseEvents(document.getElementById("lCanvas"));
  addFunctionMouseEvents(document.getElementById("l2Canvas"));
  addFunctionMouseEvents(document.getElementById("radialCanvas"));
  getById("selectText").innerHTML = '';

  nChooser = document.getElementById("nChooser");
  lChooser = document.getElementById("lChooser");
  mChooser = document.getElementById("mChooser");
  sliceChooser = document.getElementById("sliceChooser");
  viewChooser = document.getElementById("viewChooser");
  nChooser.onchange = nChooserChanged;
  lChooser.onchange = lChooserChanged;
  mChooser.onchange = orbitalChanged;
  viewChooser.onchange = viewChanged;
  sliceChooser.onchange = createOrbitals;
  getById("lCheck").onclick = setupDisplay;
  //getById("l2Check").onclick = setupDisplay;
  getById("radialCheck").onclick = setupDisplay;
  getById("energyCheck").onclick = setupDisplay;
  getById("phaseColorCheck").onclick = createPhaseTexture;
  getById("realCheck").onclick = createPhaseTexture;
  getById("imaginaryCheck").onclick = createPhaseTexture;
  createPhaseTexture();
  brightnessBar = getById("brightness");
  brightnessBar.oninput = brightnessChanged;
  getById("samplesInput").oninput = samplesChanged;
  var settingsButton = getById("settings");
  settingsButton.onclick = function () { getById("settingsDropdown").classList.toggle("show"); }

  // Close the dropdown menu if the user clicks outside of it
  window.onclick = function(event) {
    if (!hasDropdownParent(event.target)) {
      var dropdowns = document.getElementsByClassName("dropdown-content");
      var i;
      for (i = 0; i < dropdowns.length; i++) {
        var openDropdown = dropdowns[i];
        if (openDropdown.classList.contains('show')) {
          openDropdown.classList.remove('show');
        }
      }
    }
  }

  // initial rotation with z axis up
  mat4.rotate(rotationMatrix, rotationMatrix, -pi/2, [1, 0, 0]);

  setupStates();
  setupDisplay();
  createPhasors();
  createOrbitals();

  nChooser.selectedIndex = 1;
  nChooserChanged();
  lChooser.selectedIndex = 0;
  lChooserChanged();

  parseArguments();
  
  buffers = initBuffers(gl);

  var then = 0;

  // Draw the scene
  function render(now) {
    now *= 0.001;  // convert to seconds
    var deltaTime = (then) ? now - then : 0;
    then = now;

    // check if Chrome messed everything up when back button pressed
    if (mChooser.selectedIndex < 0 && !restarting) {
      window.location.reload();
      // only do it once; if we do it again it will cancel the earlier request and
      // it will never get done
      restarting = true;
    }

    // avoid large jumps when switching tabs
    deltaTime = Math.min(deltaTime, .03)

    deltaTimeWithoutSpeed = deltaTime
    var speed = document.getElementById("speed").value;
    speed = Math.exp(speed/10-5)
    deltaTime *= speed

    resizeCanvas(canvas)
    gl.viewport(0, 0, canvas.width, canvas.height);
    var norms = runPhysics(deltaTime)
    drawAtomScene(gl, buffers, deltaTime, norms);
    drawPotential(norms);
    selectText = null;
    if (getById("lCheck").checked)
      drawAngularMomentum(false);
    //if (getById("l2Check").checked) drawAngularMomentum(true);
    if (getById("radialCheck").checked)
      drawRadial();
    if (!selectedState)
      getById("selectText").innerHTML = selectText ? selectText : "";
    drawPhasors();
    updateInfo(norms)

    animating = (!stoppedCheck.checked && !dragStop) || zoomRate != 0 || autoZooming;
    if (!animating)
        then = 0
    else
        requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
  animating = true;
  refresh = function () {
      if (!animating)
          requestAnimationFrame(render);
  }

  // refresh when changing something (needed if stopped)
  stoppedCheck.onchange = function () {
    refresh()
  }

  // add button event handlers
  var func  = function(event) { event.preventDefault(); zoom(1); return false; }
  var func0 = function(event) { event.preventDefault(); zoom(0); return false; }
  handleButtonEvents("zoomin", func, func0)

  func  = function(event) { event.preventDefault(); zoom(-1); return false; }
  handleButtonEvents("zoomout", func, func0)

  getById("clear").onclick = doClear;
  getById("normalize").onclick = normalize;
  getById("maximize").onclick = maximize;
}

function hasDropdownParent(obj) {
  while (obj) {
    if (obj.className == "dropdown")
      return true;
    obj = obj.parentNode;
  }
}

function brightnessChanged() {
  var mult = Math.exp(brightnessBar.value/100.);
  userBrightMult = mult/bestBrightness;
  refresh();
}

function initBuffers(gl) {

  const extraBuffer = gl.createBuffer();
  return { extra: extraBuffer };
}

function getN() { return nChooser.selectedIndex + 1; }
function getL() { return lChooser.selectedIndex; }
function getM() { return mChooser.selectedIndex - getL(); }

// (re)create phasors needed for particular setting of viewChooser
function createPhasors() {
  phasorCount = textCount = 0;
  var i;
  for (i = 0; i != basisCount; i++)
    basisList[i].active = false;

  const canvas = document.querySelector('#statesCanvas');
  const margin = 10;
  const height = Math.max(canvas.height-margin*4, 10);
  var sz = height/4;
  var x = margin;
  var y = margin;
  var n = 1, l = 0, m = 0;
  textBoxes = [];

  switch (viewChooser.selectedIndex) {
    case VIEW_COMPLEX:
    case VIEW_REAL:
      break;
    case VIEW_COMBO_REAL:
    case VIEW_COMBO_COMP:
      phasorCount = 30;
      phasors = [];
      for (i = 0; i != phasorCount; i++) {
        var ph = phasors[i] = new Phasor(x, y, sz, sz);
        if (viewChooser.selectedIndex == VIEW_COMBO_REAL)
          ph.state = realBasis.altStates[i];
        else
          ph.state = states[i];
        x += sz;
        if (++m > l) {
          x += sz;
          l++;
          m = -l;
          if (l >= n) {
            x = margin;
            y += sz;
            n++;
            l = m = 0;
          }
        }
      }
      break;
    case VIEW_COMBO_N2L1:
      phasorCount = 12;
      phasors = [];
      i = 0;
      i = createBasisPhasors(x, y, sz, i, 2, 1);
      createText("Lz", x+sz*3, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n2l1xBasis, 3, 0);
      createText("Lx", x+sz*3, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n2l1yBasis, 3, 0);
      createText("Ly", x+sz*3, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, realBasis, 3, 2);
      createText("Real (pz,px,py)", x+sz*3, y, sz);
      break;
    case VIEW_COMBO_N3L1:
      phasorCount = 12;
      phasors = [];
      i = 0;
      i = createBasisPhasors(x, y, sz, i, 3, 1);
      createText("Lz", x+sz*3, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n3l1xBasis, 3, 0);
      createText("Lx", x+sz*3, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n3l1yBasis, 3, 0);
      createText("Ly", x+sz*3, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, realBasis, 3, 6);
      createText("Real (pz,px,py)", x+sz*3, y, sz);
      break;
    case VIEW_COMBO_N3L2:
      phasorCount = 20;
      phasors = [];
      i = 0;
      i = createBasisPhasors(x, y, sz, i, 3, 2);
      createText("Lz", x+sz*5, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n3l2xBasis, 5, 0);
      createText("Lx", x+sz*5, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n3l2yBasis, 5, 0);
      createText("Ly", x+sz*5, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, realBasis, 5, 9);
      createText("Real", x+sz*5, y, sz);
      break;
    case VIEW_COMBO_N4L1:
      phasorCount = 12;
      phasors = [];
      i = 0;
      i = createBasisPhasors(x, y, sz, i, 4, 1);
      createText("Lz", x+sz*3, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n4l1xBasis, 3, 0);
      createText("Lx", x+sz*3, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n4l1yBasis, 3, 0);
      createText("Ly", x+sz*3, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, realBasis, 3, 15);
      createText("Real (pz,px,py)", x+sz*3, y, sz);
      break;
    case VIEW_COMBO_N4L2:
      phasorCount = 20;
      phasors = [];
      i = 0;
      i = createBasisPhasors(x, y, sz, i, 4, 2);
      createText("Lz", x+sz*5, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n4l2xBasis, 5, 0);
      createText("Lx", x+sz*5, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n4l2yBasis, 5, 0);
      createText("Ly", x+sz*5, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, realBasis, 5, 18);
      createText("Real", x+sz*5, y, sz);
      break;
    case VIEW_COMBO_N4L3:
      phasorCount = 35;
      phasors = [];
      sz = height/5;
      i = 0;
      i = createBasisPhasors(x, y, sz, i, 4, 3);
      createText("Lz", x+sz*7, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n4l3xBasis, 7, 0);
      createText("Lx", x+sz*7, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n4l3yBasis, 7, 0);
      createText("Ly", x+sz*7, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, realBasis, 7, 23);
      createText("Real (General)", x+sz*7, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, n4l3CubicBasis, 7, 0);
      createText("Real (Cubic)", x+sz*7, y, sz);
      break;
    case VIEW_COMBO_HYBRID:
      sz = height/5;
      phasorCount = 20;
      phasors = [];
      i = 0;
      i = createAltPhasors(x, y, sz, i, spHybridBasis, 4, 0);
      createText("sp", x+sz*4, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, sp2HybridBasis, 4, 0);
      createText("sp2", x+sz*4, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, sp3HybridBasis, 4, 0);
      createText("sp3", x+sz*4, y, sz);
      y += sz;
      phasors[i] = new Phasor(x, y, sz, sz);
      phasors[i++].state = getState(2, 0, 0);
      i = createBasisPhasors(x+sz, y, sz, i, 2, 1);
      createText("Lz", x+sz*4, y, sz);
      y += sz;
      i = createAltPhasors(x, y, sz, i, realBasis, 4, 1);
      createText("Real (s,pz,px,py)", x+sz*4, y, sz);
      break;
  }
  for (i = 0; i != phasorCount; i++)
    phasors[i].state.setBasisActive();
  for (i = 0; i != basisCount; i++) {
    if (basisList[i].active) {
      // this clears out any states which do not have phasors present
      basisList[i].convertBasisToDerived();
      basisList[i].convertDerivedToBasis();
    }
  }

  // and if we're viewing Complex Combos, we need an extra step
  // to clear out any states with n>4.  All other views are handled
  // by the previous loop.
  if (viewChooser.selectedIndex == VIEW_COMBO_COMP)
    for (i = realBasis.altStateCount; i != stateCount; i++)
      states[i].set(0);

  // in case the states changed
  createOrbitals();
}

// clear states
function doClear() {
  var x;
  for (x = 0; x != stateCount; x++)
    states[x].set(0);
}

function normalize() {
  var norm = 0;
  var i;
  for (i = 0; i != stateCount; i++)
    norm += states[i].magSquared();
  if (norm == 0)
    return;
  var normmult = 1/Math.sqrt(norm);
  for (i = 0; i != stateCount; i++)
    states[i].mult(normmult);
  refresh();
}

function maximize() {
  var i;
  var maxm = 0;
  for (i = 0; i != stateCount; i++)
    if (states[i].mag > maxm)
      maxm = states[i].mag;
  if (maxm == 0)
    return;
  for (i = 0; i != stateCount; i++)
    states[i].mult(1/maxm);
  refresh();
}

function setLValue() {
  var l = getL();
  var i;
  mChooser.options.length = 0;
  if (viewChooser.selectedIndex == VIEW_REAL) {
    if (l == 0)
      mChooser.add(new Option(getN() + "s"));
    else if (l == 1) {
      for (i = 0; i != 3; i++)
        mChooser.add(new Option(getN() + l1RealText[i]));
    } else if (l == 2) {
      for (i = 0; i != 5; i++)
        mChooser.add(new Option(getN() + l2RealText[i]));
    } else if (l == 3 && !cubicCheck.checked) {
      for (i = 0; i != 7; i++)
        mChooser.add(new Option(getN() + l3RealText[i]));
    } else if (l == 3 && cubicCheck.checked) {
      for (i = 0; i != 7; i++)
        mChooser.add(new Option(getN() + l3CubicRealText[i]));
    } else {
      mChooser.add(new Option("m = 0"));
      for (i = 1; i <= l; i++) {
        mChooser.add(new Option("m = +-" + i + " (+)"));
        mChooser.add(new Option("m = +-" + i + " (-)"));
      }
    }
  } else {
    for (i = -l; i <= l; i++)
      mChooser.add(new Option("m = " + i));
    mChooser.selectIndex = (l);
  }
}

function setupMenus() {
  switch (viewChooser.selectedIndex) {
  case VIEW_COMPLEX:
  case VIEW_REAL:
    showDiv("nlmChooserDiv", true);
    showDiv("stateButtonsDiv", false);
    modeChooser.selectedIndex = MODE_ANGLE;
    break;
  default:
    showDiv("nlmChooserDiv", false);
    showDiv("stateButtonsDiv", true);
    break;
  }
  getById("maximize").disabled = (viewChooser.selectedIndex != VIEW_COMBO_COMP);
  cubicCheck.disabled = !(viewChooser.selectedIndex == VIEW_REAL);
}

function setupDisplay() {
  var views = [];
  var viewsToHide = ['#potentialView', '#statesView', '#lView', '#l2View', '#radialView'];

  if (getById("energyCheck").checked)
    views.push('#potentialView');

  var atomIndex = views.length;
  views.push('#atomView');

  for (i = 0; i != 2; i++) {
    var name = ['l', /*'l2',*/ 'radial'][i];
    if (getById(name + "Check").checked)
      views.push('#' + name + 'View');
  }
  if (viewChooser.selectedIndex > VIEW_COMPLEX)
    views.push('#statesView');
  var newSizes = [];
  for (i = 0; i != views.length-1; i++)
    newSizes.push(15);
  newSizes.splice(atomIndex, 0, 100-15*newSizes.length);
  if (splitViews.length != views.length) {
    if (split)
      split.destroy();
    splitViews = views;
    split = Split(views, { direction: 'vertical', minSize: 0 });
    split.setSizes(newSizes);
  }
  var i;
  for (i = 0; i != viewsToHide.length; i++) {
    var name = viewsToHide[i];
    var v = document.querySelector(name);
    v.style.display = (views.includes(name)) ? "block" : "none";
  }
  setupMenus();
  createPhasors();
}

function higherStatesPresent() {
  var i;
  for (i = realBasis.altStateCount; i != stateCount; i++)
    if (states[i].mag > 0)
      return true;
  return false;
}

function setInitialOrbital() {
  if (phasorCount == 0)
    return;
  var i;
  for (i = 0; i != stateCount; i++)
    if (states[i].mag > 0)
      return;

  phasors[0].state.set(1);
  createOrbitals();
}

function createBasisPhasors(x, y, sz, i, n, l) {
  var j;
  for (j = 0; j != l*2+1; j++) {
    var ph = phasors[i] = new Phasor(x, y, sz, sz);
    ph.state = getState(n, l, j-l);
    x += sz;
    i++;
  }
  return i;
}

function createAltPhasors(x, y, sz, i, basis, ct, offset) {
  var j;
  for (j = 0; j != ct; j++) {
    var ph = phasors[i] = new Phasor(x, y, sz, sz);
    ph.state = basis.altStates[j+offset];
    x += sz;
    i++;
  }
  return i;
}
    
function createText(text, x, y, sz) {
  const canvas = document.querySelector('#statesCanvas');
  var tb = new TextBox(x+10, y, canvas.width-x, sz, text);
  textBoxes[textCount++] = tb;
}

const codeLetter = [ "s", "p", "d", "f", "g", "h" ];

function nChooserChanged() {
  var i;
  var n = nChooser.selectedIndex+1;
  var l = lChooser.selectedIndex;
  lChooser.options.length = 0;
  for (i = 0; i < n; i++)
    lChooser.add(new Option("l = " + i + ((i < 6) ? " (" + codeLetter[i] + ")" : "")));
  if (l < n && l >= 0)
    lChooser.selectedIndex = (l);
  setLValue();
  orbitalChanged();
}

function lChooserChanged() {
  setLValue();
  orbitalChanged();
}

function viewChanged() {
  setLValue();
  orbitalChanged();
  setupDisplay();
  setInitialOrbital();
}

// this is when we are in single-orbital mode, and the user selects a different one
function orbitalChanged() {
  refresh();
  if (viewChooser.selectedIndex > VIEW_COMPLEX)
    return;
  doClear();
  if (viewChooser.selectedIndex == VIEW_REAL) {
    var m = mChooser.selectedIndex;
    if (m == 0)
      getState(getN(), getL(), 0).set(1, 0);
    else if (getL() == 3 && cubicCheck.checked) {
      var i;
      for (i = 0; i != 7; i++) {
        var ar = m*14+i*2;
        getState(getN(), 3, i-3).set(l3CubicArray[ar], l3CubicArray[ar+1]);
      }
    } else {
      m--;
      var realm = Math.floor(m/2)+1;
      var mphase = Math.pow(-1, realm);
      if ((m & 1) == 0) {
        getState(getN(), getL(),  realm).set(mphase*root2inv);
        getState(getN(), getL(), -realm).set(root2inv);
      } else {
        getState(getN(), getL(),  realm).set(0, -mphase*root2inv);
        getState(getN(), getL(), -realm).set(0, root2inv);
      }
    }
  } else
    getState(getN(), getL(), getM()).set(1, 0);
  createOrbitals();
  manualScale = false;
  updateStateLink();
}

function calcLxy(data, count, maxm, pad, xAxis, square) {
  var i;
  var mid = Math.floor(count/2);
  for (i = 0; i != count; i++)
    data[i] = 0;

  if (square)
    mid = 1;
  for (i = 0; i != basisCount; i++) {
    // find all alternate basis objects which contain
    // L eigenstates corresponding to the axis we want
    var ab = basisList[i];
    if (ab.n == 0 || ab.xAxis != xAxis)
      continue;

    // convert to the basis
    ab.convertBasisToDerived();

    var j;
    for (j = 0; j != ab.altStateCount; j++) {
      var ds = ab.altStates[j];
      if (square)
        data[mid+ds.m*ds.m*pad] += ds.magSquared();
      else
        data[mid+ds.m*pad] += ds.magSquared();
    }
  }

  // include s states
  for (i = 0; i != stateCount; i++) {
    if (states[i].l == 0)
      data[mid] += states[i].magSquared();
  }
  for (i = 0; i != count; i++)
    data[i] = Math.sqrt(data[i]);
}

function calcLz(data, count, maxm, pad, square) {
  var i;
  var mid = Math.floor(count/2);

  for (i = 0; i != count; i++)
    data[i] = 0;
  if (square)
    mid = 1;
  for (i = 0; i != stateCount; i++) {
    var bs = states[i];
    if (bs.l <= maxm) {
      if (square)
        data[mid+bs.m*bs.m*pad] += bs.magSquared();
      else
        data[mid+bs.m*pad] += bs.magSquared();
    }
  }
  for (i = 0; i != count; i++)
    data[i] = Math.sqrt(data[i]);
}

// rotate states (not view) around x or y axis
function rotateXY(ang, xAxis) {
  var i;
  for (i = 0; i != basisCount; i++) {
    // find all alternate basis objects which contain
    // L eigenstates corresponding to the axis we want
    var ab = basisList[i];
    if (ab.n == 0 || ab.xAxis != xAxis)
      continue;

    // convert to the basis
    ab.convertBasisToDerived();

    // rotate all the states in the basis around the axis
    var j;
    for (j = 0; j != ab.altStateCount; j++) {
      var ds = ab.altStates[j];
      ds.rotate(ang*ds.m);
    }
  }

  // clear out all states which are not spherically symmetric
  for (i = 0; i != stateCount; i++) {
    if (states[i].l > 0)
      states[i].set(0);
  }

  // convert back to the Lz basis
  for (i = 0; i != basisCount; i++) {
    var ab = basisList[i];
    if (ab.n == 0 || ab.xAxis != xAxis)
      continue;
    ab.convertDerivedToBasis(false);
  }

  createOrbitals();
  refresh();
}

// rotate states (not view) around z axis
function rotateZ(ang) {
  var i;
  for (i = 0; i != stateCount; i++) {
    var bs = states[i];
    bs.rotate(ang*bs.m);
  }
  refresh();
}

function samplesChanged() {
  compiledStates = undefined;
  createOrbitals();
}

// check if shader needs to be updated to display current states
function createOrbitals() {
  var i;
  var newOrbitals = false;
  var newStates = [];
  for (i = 0; i != stateCount; i++) {
    var st = states[i];
    if (st.m == 0) {
      if (st.mag != 0) {
        newStates.push(st);
        if (!st.compiled)
          newOrbitals = true;
      }
    } else if (st.m > 0) {
      if (st.mag != 0 || getState(st.n, st.l, -st.m).mag != 0) {
        newStates.push(st);
        if (!st.compiled)
          newOrbitals = true;
      }
    }
  }
  if (newStates.length == 0)
    newStates = [getState(1, 0, 0)];
  var sliced = sliceChooser.selectedIndex > SLICE_NONE;
  if (!newOrbitals && compiledStates != undefined && compiledSliced == sliced)
    return;
  createAtomProgram(newStates);
  compiledStates = newStates;
  compiledSliced = sliced;
  for (i = 0; i != stateCount; i++)
    states[i].compiled = false;
  for (i = 0; i != newStates.length; i++)
    compiledStates[i].compiled = true;
}

// get standard basis state
function getState(n, l, m) {
  if (!Number.isInteger(n) || !Number.isInteger(l) || !Number.isInteger(m))
    console.log("bad arguments to getState: " + n + " " + l + " " + m);
  var pre_n = n-1;
  var pre_n_add = pre_n*(pre_n+1)*(2*pre_n+1)/6;
  var pre_l_add = l*l;
  return states[pre_n_add+pre_l_add+l+m];
}

function setupStates() {
  // set up standard basis (complex, physics) used by the drawing code.
  // we convert into this basis before drawing anything
  var maxn = 16;
  stateCount = maxn*(maxn+1)*(2*maxn+1)/6;
  var i;
  states = [];
  var n = 1;
  var l = 0;
  var m = 0;
  for (i = 0; i != stateCount; i++) {
    var bs = states[i] = new BasisState();
    bs.elevel = -1/(2.*n*n);
    bs.n = n;
    bs.l = l;
    bs.m = m;
    if (m < l)
      m++;
    else {
      l++;
      if (l < n)
        m = -l;
      else {
        n++;
        l = m = 0;
      }
    }
  }

  basisList = [];
  basisCount = 0;

 // set up real basis
  realBasis = new AlternateBasis();
  var maxRealN = 4;
  var realct = realBasis.altStateCount = maxRealN*(maxRealN+1)*(2*maxRealN+1)/6;
  realBasis.altStates = [];
  n = 1;
  l = m = 0;
  for (i = 0; i != realct; i++) {
    var ds = realBasis.altStates[i] = new DerivedState();
    ds.basis = realBasis;
    if (m == 0) {
      ds.count = 1;
      ds.bstates = [ getState(n, l, 0) ];
      ds.coefs = [ new Complex(1, 0) ];
    } else {
      var m0 = m-1;
      var realm = Math.floor(m0/2)+1;
      ds.count = 2;
      ds.bstates = [];
      ds.bstates[0] = getState(n, l,  realm);
      ds.bstates[1] = getState(n, l, -realm);
      ds.coefs = [];
      var mphase = Math.pow(-1, realm);
      if ((m0 & 1) == 0) {
        ds.coefs[0] = new Complex(mphase*root2inv, 0);
        ds.coefs[1] = new Complex(root2inv, 0);
      } else {
        ds.coefs[0] = new Complex(0, mphase*root2inv);
        ds.coefs[1] = new Complex(0, -root2inv);
      }
    }
    ds.elevel = ds.bstates[0].elevel;
    switch (l) {
    case 0: ds.text = n + "s"; break;
    case 1: ds.text = n + l1RealText[m]; break;
    case 2: ds.text = n + l2RealText[m]; break;
    case 3: ds.text = n + l3RealText[m]; break;
    }
    if (m < l*2)
      m++;
    else {
      l++;
      if (l < n)
        m = 0;
      else {
        n++;
        l = m = 0;
      }
    }
  }

  n2l1xBasis = setupLBasis(2, 1, true, l1xArray);
  n2l1yBasis = setupLBasis(2, 1, false, l1yArray);
  n3l1xBasis = setupLBasis(3, 1, true, l1xArray);
  n3l1yBasis = setupLBasis(3, 1, false, l1yArray);
  n3l2xBasis = setupLBasis(3, 2, true, l2xArray);
  n3l2yBasis = setupLBasis(3, 2, false, l2yArray);
  n4l1xBasis = setupLBasis(4, 1, true, l1xArray);
  n4l1yBasis = setupLBasis(4, 1, false, l1yArray);
  n4l2xBasis = setupLBasis(4, 2, true, l2xArray);
  n4l2yBasis = setupLBasis(4, 2, false, l2yArray);
  n4l3xBasis = setupLBasis(4, 3, true, l3xArray);
  n4l3yBasis = setupLBasis(4, 3, false, l3yArray);
  n4l3CubicBasis = setupLBasis(4, 3, false, l3CubicArray);
  n4l3CubicBasis.n = 0;
  spHybridBasis = setupHybridBasis(spHybridArray, spHybridText);
  sp2HybridBasis = setupHybridBasis(sp2HybridArray, sp2HybridText);
  sp3HybridBasis = setupHybridBasis(sp3HybridArray, sp3HybridText);
}

function setupLBasis(n, l, xAxis, arr) {
  var sct = l*2+1;
  var basis = new AlternateBasis();
  basis.n = n;
  basis.l = l;
  basis.xAxis = xAxis;
  var mtext = (xAxis) ? "m<sub>x</sub>" : "m<sub>y</sub>";
  basis.altStates = [];
  basis.altStateCount = sct;
  var i;
  for (i = 0; i != sct; i++) {
    var ds = basis.altStates[i] = new DerivedState();
    ds.basis = basis;
    ds.count = sct;
    ds.bstates = [];
    ds.coefs = [];
    ds.m = i-l;
    var j;
    for (j = 0; j != sct; j++) {
      ds.bstates[j] = getState(n, l, j-l);
      ds.coefs[j] = new Complex();
    }
    ds.elevel = ds.bstates[0].elevel;
    if (arr == l3CubicArray)
      ds.text = "4" + l3CubicRealText[i];
    else
      ds.text = "n = " + n + ", l = " + l + ", " + mtext + " = " + ds.m;
  }
  var ap = 0;
  for (i = 0; i != sct; i++) {
    var j;
    for (j = 0; j != sct; j++) {
      basis.altStates[i].coefs[j].set(arr[ap], arr[ap+1]);
      ap += 2;
    }
  }
  return basis;
}

function setupHybridBasis(arr, names) {
  var sct = 4;
  var basis = new AlternateBasis();
  basis.altStates = [];
  basis.altStateCount = sct;
  var i;
  for (i = 0; i != sct; i++) {
    var ds = basis.altStates[i] = new DerivedState();
    ds.basis = basis;
    ds.count = sct;
    ds.bstates = [];
    ds.coefs = [];
    ds.text = names[i];
    var j;
    ds.bstates[0] = getState(2, 0, 0);
    ds.coefs[0] = new Complex();
    for (j = 0; j != 3; j++) {
      ds.bstates[j+1] = getState(2, 1, j-1);
      ds.coefs[j+1] = new Complex();
    }
    ds.elevel = ds.bstates[0].elevel;
  }
  var ap = 0;
  for (i = 0; i != sct; i++) {
    var j;
    for (j = 0; j != sct; j++) {
      basis.altStates[i].coefs[j].set(arr[ap], arr[ap+1]);
      ap += 2;
    }
  }
  return basis;
}

// Lx and Ly eigenvectors for various values of l, expressed in
// terms of Lz eigenvectors
const l1xArray = [ .5, 0, -root2inv, 0, .5, 0, root2inv, 0, 0, 0, -root2inv, 0, .5, 0, root2inv, 0, .5, 0 ];
const l1yArray = [ .5, 0, 0, -root2inv, -.5, 0, 0, -root2inv, 0, 0, 0, -root2inv, .5, 0, 0, root2inv, -.5, 0 ];
const l2xArray = [
  1/4., 0, -1/2., 0, root6by4, 0, -1/2., 0, 1/4., 0,
  -.5, 0, .5, 0, 0, 0, -.5, 0, .5, 0,
  root6by4, 0, 0, 0, -.5, 0, 0, 0, root6by4, 0,
  -.5, 0, -.5, 0, 0, 0, .5, 0, .5, 0,
  1/4., 0, 1/2., 0, root6by4, 0, 1/2., 0, 1/4., 0
];
const l2yArray = [
  1/4., 0, 0, -1/2., -root6by4, 0, 0, 1/2., 1/4., 0,
  -.5,  0, 0, .5, 0, 0, 0,      .5,       .5, 0,
  -root6by4, 0, 0, 0, -.5, 0, 0, 0, -root6by4, 0,
  -.5, 0, 0, -.5, 0, 0, 0, -.5, .5, 0,
  1/4., 0, 0,  1/2., -root6by4, 0, 0, -1/2., 1/4., 0
];
const l3xArray = [
  0.125,0, -0.306186,0, 0.484123,0, -0.559017,0, 0.484123,0, -0.306186,0, 0.125,0,
  -0.306186,0, 0.5,0, -0.395285,0, 0.,0, 0.395285,0, -0.5,0, 0.306186,0,
  0.484123,0, -0.395285,0, -0.125,0, 0.433013,0, -0.125,0, -0.395285,0, 0.4841230,0,
  0.559017,0, 0.,0, -0.433013,0, 0.,0, 0.433013,0, 0.,0, -0.559017,0,
  0.484123,0, 0.395285,0, -0.125,0, -0.433013,0, -0.125,0, 0.395285,0, 0.484123,0,
  -0.306186,0, -0.5,0, -0.395285,0, 0.,0, 0.395285,0, 0.5,0, 0.306186,0,
  0.125,0, 0.306186,0, 0.484123,0, 0.559017,0, 0.484123,0, 0.306186,0, 0.125,0
];
const l3yArray = [
        -0.125,0, 0,0.306186, 0.484123,0, 0,-0.559017,
          -0.484123,0, 0,0.306186, 0.125,0,
        0.306186,0, 0,-0.5, -0.395285,0, 0.,0,
          -0.395285,0, 0,0.5, 0.306186,0,
        -0.484123,0, 0,0.395285, -0.125,0, 0,0.433013,
          0.125,0, 0,0.395285, 0.484123,0,
        0,0.559017, 0.,0, 0,0.433013, 0.,0,
          0,0.433013, 0.,0, 0,0.559017,
        -0.484123,0, 0,-0.395285, -0.125,0, 0,-0.433013,
          0.125,0, 0,-0.395285, 0.484123,0,
        0.306186,0, 0,+0.5, -0.395285,0, 0.,0, -0.395285,0,
          0,-0.5, 0.306186,0,
        -0.125,0, 0,-0.306186, 0.484123,0, 0,+0.559017,
          -0.484123,0, 0,-0.306186, 0.125,0
];
const l3CubicArray = [
        0,0, 0,0, 0,0, 1,0, 0,0, 0,0, 0,0,
        .559017,0, 0,0, -.433013,0, 0,0, .433013,0, 0,0, -.559017,0,
        0,.559017, 0,0, 0,.433013, 0,0, 0,.433013, 0,0, 0,.559017,
        0,0, root2inv,0, 0,0, 0,0, 0,0, root2inv,0, 0,0,
        0,0, 0,-root2inv, 0,0, 0,0, 0,0, 0,root2inv, 0,0,
        .433013,0, 0,0, .559017,0, 0,0, -.559017,0, 0,0, -.433013,0,
        0,.433013, 0,0, 0,-.559017, 0,0, 0,-.559017, 0,0, 0,.433013
];

const spHybridArray = [
        -root2inv, 0,  0, 0,  -root2inv, 0,  0, 0,
        -root2inv, 0,  0, 0,  root2inv, 0,  0, 0,
        0, 0,  root2inv, 0,  0, 0,  -root2inv, 0,
        0, 0,  0, -root2inv,  0, 0,  0, -root2inv,
];
const sp2HybridArray = [
        -.57735, 0,  .57735, 0,   0, 0,  -.57735, 0,
        -.57735, 0,  -.288675, -.5,  0, 0,  .288675, -.5,
        -.57735, 0,  -.288675, .5,  0, 0,  .288675, .5,
        0, 0,  0, 0,  1, 0,  0, 0
];
// px = (m=-1 - m=1) *root2inv
// py = (i m=-1 + i m=1) * root2inv
const sp3HybridArray = [
        -.5, 0,  -root2inv/2, root2inv/2,  -.5, 0,  root2inv/2, root2inv/2,
        -.5, 0,  root2inv/2, -root2inv/2,  -.5, 0,  -root2inv/2, -root2inv/2,
        -.5, 0,  root2inv/2, root2inv/2,  .5, 0,  -root2inv/2, root2inv/2,
        -.5, 0,  -root2inv/2, -root2inv/2,  .5, 0,  root2inv/2, -root2inv/2,
];
const spHybridText = [ "2sp (1)", "2sp (2)", "2px", "2py" ];
const sp2HybridText = [ "2sp2 (1)", "2sp2 (2)", "2sp2 (3)", "2pz" ];
const sp3HybridText = [ "2sp3 (1)", "2sp3 (2)", "2sp3 (3)", "2sp3 (4)" ];
const l1RealText = [ "pz", "px", "py" ];
const l2RealText = [ "dz2", "dxz", "dyz", "d(x2-y2)", "dxy" ];
const l3RealText = [ "fz3", "fxz2", "fyz2", "fz(x2-y2)", "fxyz", "fx(x2-3y2)", "fy(3x2-y2)" ];
const l3CubicRealText = [ "fz3", "fx3", "fy3", "fz(x2-y2)", "fxyz", "fx(z2-y2)", "fy(z2-x2)" ];

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

// run physics simulation for current frame
function runPhysics(deltaTime) {
  if (stoppedCheck.checked)
    deltaTime = 0;
  time += deltaTime
  zoom3d *= Math.exp(deltaTimeWithoutSpeed*zoomRate)

  // update phases
  var i;
  var norm = 0;
  for (i = 0; i != stateCount; i++) {
    var st = states[i];
    if (st.mag < 1e-4) {
      st.set(0);
      continue;
    }
    if (deltaTime > 0)
      st.rotate(-(st.elevel+baseEnergy)*deltaTime);
    norm += st.magSquared();
  }

  var normmult2 = 1/norm;
  if (norm == 0)
    normmult2 = 0;
  var normmult = Math.sqrt(normmult2);

  var skipBasis = (changingDerivedStates) ?  selectedState.basis : null;
  for (i = 0; i != basisCount; i++) {
    var basis = basisList[i];
    if (basis != skipBasis && basis.active)
      basis.convertBasisToDerived();
  }
  return {norm:norm, normmult: normmult, normmult2: normmult2};
}

function angleDiff(a, b) {
  if (a > b)
    a -= Math.PI*2
  return b-a
}

function minimumAngleDiff(a, b) {
  var d = Math.abs(a-b) % (Math.PI*2)
  if (d > Math.PI)
    d = 2*Math.PI - d
  return d
}

// current angular position in orbit
function orbitAngle(orb) {
  return orb.meanAnomaly - orb.argumentOfPeriapsis
}

const minDeltaTime = .000001

// verify if x is between a and b
function checkInRange(a, x, b) {
  if (a <= x && x <= b)
    return true
  if (b <= x && x <= a)
    return true
  return false
}

function vectorPerpendicularToPlane(orb) {
  var rot = mat4.create();
  mat4.rotate(rot, rot, -orb.longitudeAscendingNode, [0, 1, 0]);
  mat4.rotate(rot, rot, orb.inclination, [1, 0, 0]);
  var vec = [0, 1, 0];
  vec3.transformMat4(vec, vec, rot);
  return vec;
}

function drawAtomScene(gl, buffers, deltaTime, norms) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque

  gl.clear(gl.COLOR_BUFFER_BIT);
  projectionMatrix = mat4.create();

  // if window is more tall than wide, adjust fov to zoom out or the earth will be cut off on the sides
  var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  var fov = Math.atan(aspect > 1 ? 1 : 1/aspect);
  mat4.perspective(projectionMatrix, fov, aspect, 0.1, 100);

  setScale();
  setBrightness(norms.normmult2);

  viewMatrix = mat4.create();
  mat4.translate(viewMatrix, viewMatrix, [0, 0, -6]);
  mat4.multiply(viewMatrix, viewMatrix, rotationMatrix);
  const sliceScale = 1.5;
  mat4.scale(viewMatrix, viewMatrix, [sliceScale, sliceScale, sliceScale]);
  mat4.invert(inverseRotationMatrix, rotationMatrix);
  if (sliceChooser.selectedIndex != SLICE_NONE)
    drawCube(gl, buffers, projectionMatrix, viewMatrix, true);
  drawFullAtom(norms.normmult);
  if (getById("componentsCheck").checked)
    drawComponentAtoms(norms.normmult);
  if (sliceChooser.selectedIndex != SLICE_NONE)
    drawCube(gl, buffers, projectionMatrix, viewMatrix, false);
  if (getById("axesCheck").checked)
    drawAxes(gl, buffers, viewMatrix);
  else
    hideAxes();
}

function setScale() {
  autoZooming = false;
  if (manualScale || !getById("autoScaleCheck").checked)
    return;
  var i;

  // find max radius
  var outer = 0;
  for (i = 0; i != compiledStates.length; i++) {
    var st = compiledStates[i];
    var r = st.getScaleRadius();
    if (r > outer)
      outer = r;
  }

  // find goal
  var goal = 7.35/outer;
  if (!getById("animScaleCheck").checked) {
    zoom3d = goal;
    return;
  }

  // gradually change zoom until we reach goal
  var diff = goal-zoom3d;
  var mult = Math.exp(deltaTimeWithoutSpeed*3);
  var newZoom = (diff > 0) ? zoom3d*mult : zoom3d/mult;
  if (Math.sign(diff) != Math.sign(goal-newZoom))
    zoom3d = goal;
  else {
    zoom3d = newZoom;
    autoZooming = true;
  }
}

function setBrightness(normmult) {
  var i;
  var avg = 0;
  var totn = 0;
  var minavg = 1e30;
  for (i = 0; i != compiledStates.length; i++) {
    var st = compiledStates[i];
    var as = st.getBrightness();
    if (as < minavg)
      minavg = as;
    var n = st.magSquared()*normmult;
    if (st.m != 0)
      n += getState(st.n, st.l, -st.m).magSquared()*normmult;
    totn += n;
    avg += n*as;
  }
  bestBrightness = 113.9/(Math.sqrt(minavg)*totn);
  var mult = bestBrightness * userBrightMult;
  var bvalue = Math.round(Math.log(mult)*100.);
  brightnessBar.value = bvalue;
}

function drawAxes(gl, buffers, viewMatrix) {
  gl.viewport(gl.canvas.width-100, gl.canvas.height-100, 100, 100);
  const projectionMatrix = mat4.create();
  var aspect = 1;
  var fov = Math.atan(aspect);
  mat4.perspective(projectionMatrix, fov, aspect, 0.1, 100);

  const scaledViewMatrix = mat4.create();

  var scale = 1.1;
  mat4.scale(scaledViewMatrix, viewMatrix, [scale, scale, scale, 1]);
  
  // hack to save and restore zoom level since drawArrow looks at it
  var saveZoom = zoom3d;
  zoom3d = .4;

  drawArrow(gl, buffers, projectionMatrix, scaledViewMatrix, [0, 0, 0], [1, 0, 0], [1, 1, 1], false);
  drawArrow(gl, buffers, projectionMatrix, scaledViewMatrix, [0, 0, 0], [0, 1, 0], [1, 1, 1], false);
  drawArrow(gl, buffers, projectionMatrix, scaledViewMatrix, [0, 0, 0], [0, 0, 1], [1, 1, 1], false);
  zoom3d = saveZoom;

  var i;
  for (i = 0; i != 3; i++) {
    var vec = vec4.create();
    vec[i] = 1.3; vec[3] = 1;
    vec4.transformMat4(vec, vec, scaledViewMatrix);
    vec4.transformMat4(vec, vec, projectionMatrix);
    var div = document.getElementById("xyz".substring(i, i+1) + "Label");
    div.style.left = (gl.canvas.width-100 + Math.floor(50-5+50*(vec[0]/vec[3]))) + "px";
    div.style.top = Math.floor(50-5-50*(vec[1]/vec[3])) + "px";
  }
}

function hideAxes() {
  var i;
  for (i = 0; i != 3; i++) {
    var div = document.getElementById("xyz".substring(i, i+1) + "Label");
    div.style.left = "-50px";
  }
}

function drawArrow(gl, buffers, projectionMatrix, viewMatrix, pos, arrowVec, col, rotational) {
  gl.useProgram(colorPlainProgramInfo.program);
  const modelViewMatrix = mat4.create();
  mat4.copy(modelViewMatrix, viewMatrix);

  pos = Array.from(pos)  // make sure it's an array
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.extra);

  var vecLen = Math.sqrt(vec3.dot(arrowVec, arrowVec))

  var arrowLen = 1
  var arrowHeadSize = .20/vecLen * (.4/zoom3d);
  if (arrowHeadSize > .5)
     arrowHeadSize = .5
  var verts = []
  var arrowTip = []
  var crossVec = vec3.create()
  var zVec = vec3.create()

  // find a vector perpendicular to arrow vector and eye vector, so the arrowhead can be seen
  vec3.transformMat4(zVec, [0, 0, 1], inverseRotationMatrix)
  vec3.cross(crossVec, arrowVec, zVec)
  vec3.normalize(crossVec, crossVec);

  var cross2Vec = vec3.create();
  vec3.cross(cross2Vec, crossVec, arrowVec);
  vec3.normalize(cross2Vec, cross2Vec);

  const shaftWidth = .02 * (.4/zoom3d);
  const headWidth = .08 * (.4/zoom3d);
  var shaftStart1 = [], shaftStart2 = [], shaftEnd1 = [], shaftEnd2 = [], head1 = [], head2 = [];
  var shaftLen = 1-arrowHeadSize;
  var i;

  // calculate arrow points
  for (i = 0; i != 3; i++) {
    // points on either side of shaft at start
    shaftStart1.push(pos[i]+crossVec[i]*shaftWidth);
    shaftStart2.push(pos[i]-crossVec[i]*shaftWidth);

    // points on either side of shaft at end
    shaftEnd1.push(pos[i]+crossVec[i]*shaftWidth+arrowVec[i]*shaftLen);
    shaftEnd2.push(pos[i]-crossVec[i]*shaftWidth+arrowVec[i]*shaftLen);

    // points on either side of head
    head1.push(pos[i]+crossVec[i]*headWidth+arrowVec[i]*shaftLen);
    head2.push(pos[i]-crossVec[i]*headWidth+arrowVec[i]*shaftLen);

    // tip of arrow
    arrowTip.push(pos[i]+arrowVec[i]*arrowLen);
  }

  verts = verts.concat(shaftStart1, shaftEnd1, shaftStart2, shaftEnd1, shaftStart2, shaftEnd2, head1, head2, arrowTip);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(colorPlainProgramInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(colorPlainProgramInfo.attribLocations.vertexPosition);

  gl.uniformMatrix4fv(colorPlainProgramInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(colorPlainProgramInfo.uniformLocations.modelViewMatrix,  false, modelViewMatrix);
  gl.uniform4f(colorPlainProgramInfo.uniformLocations.color, col[0], col[1], col[2], 1);
  gl.drawArrays(gl.TRIANGLES, 0, 9);
  gl.disableVertexAttribArray(colorPlainProgramInfo.attribLocations.vertexPosition);
}

function getScaler() {
  var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  var scale = Math.max(1, aspect);
  var xp = 20/zoom3d;
  return xp*scale/gl.canvas.width;
}

function drawPotential(norms) {
  const canvas = document.querySelector('#potentialCanvas');
  resizeCanvas(canvas);
  var ctx = canvas.getContext('2d');
  var ymult = canvas.height * 1.9;
  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = "#444";
  var i;
  for (i = 1; i != 16; i++) {
    var e = -1/(2.*i*i);
    var y = -(ymult * e);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  var xp = getScaler();
            
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  var ox = -1;
  var x;
  var floory = canvas.height-1;
  for (x = 0; x != canvas.width; x++) {
    var xx = (x-canvas.width/2)*xp;
    if (xx < 0)
      xx = -xx;
    if (xx < 1e-3)
      xx = 1e-3;
    var dy = -1/xx;
    var y = -(ymult * dy);
    if (y > floory) {
      if (ox == -1)
        continue;
      ctx.lineTo(ox, floory);
      ox = -1;
      continue;
    }
    if (ox == -1 && x > 0) {
      ctx.moveTo(x, floory);
      ox = x;
    }
    if (ox == -1)
      ctx.moveTo(x, y);
    else
      ctx.lineTo(x, y);
    ox = x;
  }
  ctx.stroke();

  // calculate expectation value of E
  const norm = norms.norm;
  const normmult2 = norms.normmult2;
  if (norm != 0) {
    var expecte = 0;
    for (i = 0; i != stateCount; i++) {
      var st = states[i];
      var prob = st.magSquared()*normmult2;
      expecte += prob*st.elevel;
    }
    var y = -(ymult * expecte);
    ctx.beginPath();
    ctx.strokeStyle = 'red';
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
            
  if (selectedState != null && !dragging) {
    ctx.strokeStyle = 'yellow';
    var y = -(ymult * selectedState.elevel);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function setupCanvas(canvas) {
  resizeCanvas(canvas);
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return ctx;
}

function drawAngularMomentum(squared) {
  const canvas = document.querySelector(squared ? "#l2Canvas" : '#lCanvas');
  var ctx = setupCanvas(canvas);
  var maxm = 3;
  var ldata = [];

  var i;
  for (i = 0; i != states.length; i++) {
    if (states[i].mag > 0 && states[i].l >= maxm)
      maxm = states[i].l+1;
  }
  const pad = squared ? 2 : 3;
  const ct = (maxm*2+1)*pad;
  if (!higherStatesPresent()) {
    calcLxy(ldata, ct, maxm, pad, true, false);
    drawFunction(ctx, canvas, 0, ldata, ct, pad, squared, "m<sub>x</sub>");
    calcLxy(ldata, ct, maxm, pad, false, false);
    drawFunction(ctx, canvas, 1, ldata, ct, pad, squared, "m<sub>y</sub>");
  }
  calcLz(ldata, ct, maxm, pad, false);
  drawFunction(ctx, canvas, 2, ldata, ct, pad, squared, "m<sub>z</sub>");
}

function drawRadial() {
  if (viewChooser.selectedIndex > VIEW_COMPLEX)
    return;
  const canvas = document.querySelector('#radialCanvas');
  var ctx = setupCanvas(canvas);
  var orb = compiledStates[0];
  const n = orb.n;
  const l = orb.l;
  const norm = radialNorm(n, l);
  const ct = canvas.width*2;
  var ldata = [];
  var sr = orb.getScaleRadius()*3;
  var bestCt = ct;
  var max = -1;

  var i;
  for (i = 0; i != ct; i++) {
    var r = i*sr/ct + 1e-8;
    var rho = 2*r/n;
    var rhol = Math.pow(rho, l)*norm;
    var dr = confluentHypergeometricFunction(l+1-n, 2*l+2, rho)*rhol*Math.exp(-rho/2)*norm;
    ldata[i] = dr*dr*r*r;
    if (ldata[i] > max) max = ldata[i];
    if (ldata[i] > max*.01)
      bestCt = i;
  }
  var scaleVal = sr*bestCt/ct;
  drawRadialFunction(ctx, canvas, ldata, bestCt, scaleVal);
}

function drawPhasors() {
  const canvas = document.querySelector('#statesCanvas');
  if (resizeCanvas(canvas))
    createPhasors();
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  var i;
  for (i = 0; i != phasorCount; i++) {
    var ph = phasors[i];
    var st = ph.state;
    var ss = ph.width;
    var ss2 = ss/2;
    var x = ph.x + ss2;
    var y = ph.y + ss2;
    var yel = (selectedState == st);
    ctx.strokeStyle = (yel) ? '#ff0' : (st.mag == 0) ? '#888' : '#fff';
    ctx.beginPath();
    ctx.arc(x, y, ss2, 0, Math.PI*2);
    var xa = (st.re*ss2);
    var ya = (-st.im*ss2);
    ctx.moveTo(x, y);
    ctx.lineTo(x+xa, y+ya);
    ctx.arc(x+xa, y+ya, 1, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.font = '24px serif';
  ctx.fillStyle = "white";
  ctx.textBaseline = 'middle';
  for (i = 0; i != textCount; i++) {
    var tb = textBoxes[i];
    if (tb.height > 20)
      ctx.fillText(tb.text, tb.x, tb.y + tb.height/2);
  }
}

function drawLine(ctx, ss, x1, y1, x2, y2) {
  ctx.strokeStyle = ss;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawFunction(ctx, canvas, pos, fr, count, pad, fromZero, selText) {
  var i;
  var expectx = 0;
  var expectx2 = 0;
  var maxsq = 0;
  var tot = 0;
  var vw = canvas.width/3;
  var vw2 = vw*4/5;
  var mid_x = (fromZero) ? Math.floor(vw2/(count-1)) : vw2 * Math.floor(count/2) / (count-1);
  var zero = mid_x;
  mid_x += vw*pos;
  for (i = 0; i != count; i++) {
    var x = vw2 * i / (count-1);
    var ii = i;
    var dr = fr[ii];
    var dy = dr*dr;
    if (dy > maxsq)
      maxsq = dy;
    var dev = x-zero;
    expectx += dy*dev;
    expectx2 += dy*dev*dev;
    tot += dy;
  }
  zero = mid_x;
  expectx /= tot;
  expectx2 /= tot;
  var maxnm = Math.sqrt(maxsq);
  var uncert = Math.sqrt(expectx2-expectx*expectx);
  var ox = -1, oy = 0;
  var bestscale = 1/maxnm;
  var scale = bestscale;
  if (scale > 1e8)
    scale = 1e8;
  drawLine(ctx, '#888', mid_x, 0, mid_x, canvas.height);

  var ymult2 = .90*canvas.height;
  var mid_y = canvas.height/2+ymult2/2;
  var mult = ymult2*scale;
  ctx.strokeStyle = 'white';
  ctx.beginPath();
  for (i = 0; i != count; i++) {
    var x = vw2 * i / (count-1) + vw*pos;
    var ii = i;
    var y = mid_y - (mult * fr[ii]);
    if (i == 0)
      ctx.moveTo(x, y);
    else
      ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#888';
  var sep = vw2*pad/(count-1);
  for (i = 1; i < count; i += pad) {
    var x = vw2 * i / (count-1) + vw*pos;
    if (canvas.mouseX && Math.abs(canvas.mouseX-x) < sep/2) {
      drawLine(ctx, 'yellow', x, 0, x, canvas.height);
      var m = (i-1)/pad;
      if (!fromZero)
        m -= Math.floor(count/2/pad);
      selectText = selText + " = " + m;
    } else
      drawLine(ctx, '#888', x, mid_y, x, mid_y+4);
  }
  ctx.stroke();

  if (maxsq > 0) {
    expectx += zero + .5;
    drawLine(ctx, 'red', expectx, 0, expectx, canvas.height);
  }
}

function drawFullAtom(normmult) {
  var phases = [];
  var i;
  // calculate phases
  for (i = 0; i != compiledStates.length; i++) {
    var st = compiledStates[i];
    if (st.m == 0)
      phases.push(st.re, st.im, 0, 0);
    else {
      // get phases for m != 0
      // convert exp(i m phi), e(-i m phi) basis to cos(m phi), sin(m phi) basis
      // also need a negative sign for odd m
      var mphase = Math.pow(-1, st.m);
      var s2 = getState(st.n, st.l, -st.m);
      phases.push(st.re*mphase+s2.re, st.im*mphase+s2.im, -st.im*mphase+s2.im, st.re*mphase-s2.re);
    }
  }
  for (i = 0; i != phases.length; i++)
    phases[i] *= normmult;
  drawAtom(phases);
}

function drawComponentAtoms(normmult) {
  var i, j;

  var vc = viewChooser.selectedIndex;

  // show complex components if we're showing real single orbitals or combinations of complex orbitals.
  // otherwise, real
  var complex = (vc == VIEW_REAL || vc == VIEW_COMBO_COMP);

  var phaseList = [];

  // start with array of zeros
  var phases = [];
  for (i = 0; i != compiledStates.length; i++)
    phases.push(0, 0, 0, 0);

  // calculate phases for each component
  var pos = 0;
  for (i = 0; i != compiledStates.length; i++) {
    var st = compiledStates[i];
    if (st.m == 0) {
      if (st.mag > 0) {
        phases.splice(i*4, 4, st.re, st.im, 0, 0);
        // push copy of array
        phaseList.push([...phases]);
      }
    } else {
      // get phases for m != 0
      // convert exp(i m phi), e(-i m phi) basis to cos(m phi), sin(m phi) basis
      // also need a negative sign for odd m
      var mphase = Math.pow(-1, st.m);
      var s2 = getState(st.n, st.l, -st.m);
      if (complex) {
        if (st.mag > 0) {
          phases.splice(i*4, 4, normmult*(st.re*mphase), normmult*(st.im*mphase),
                                normmult*(-st.im*mphase), normmult*(st.re*mphase));
          phaseList.push([...phases]);
        }
        if (s2.mag > 0) {
          phases.splice(i*4, 4, normmult*s2.re, normmult*s2.im,
                                normmult*s2.im, -normmult*s2.re);
          phaseList.push([...phases]);
        }
      } else {
        var a = (st.re*mphase+s2.re);
        var b = (st.im*mphase+s2.im);
        if (Math.abs(a) > 1e-8 || Math.abs(b) > 1e-8) {
          phases.splice(i*4, 4, normmult*a, normmult*b, 0, 0);
          phaseList.push([...phases]);
        }
        a = -st.im*mphase+s2.im;
        b =  st.re*mphase-s2.re;
        if (Math.abs(a) > 1e-8 || Math.abs(b) > 1e-8) {
          phases.splice(i*4, 4, 0, 0, normmult*a, normmult*b);
          phaseList.push([...phases]);
        }
      }
    }
    phases.splice(i*4, 4, 0, 0, 0, 0);
  }

  // more than one component?  if not, we're done
  if (phaseList.length < 2)
    return;

  for (i = 0; i != phaseList.length; i++)
    drawAtom(phaseList[i], i);

  // restore viewport
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

function drawAtom(phases, pos) {
  var program = atomProgramInfo;
  gl.useProgram(program.program);
  
  var verts = [-1,-1,0, -1,1,0, 1,-1,0, 1,1,0];
  var slice = sliceChooser.selectedIndex;
  if (slice > SLICE_NONE) {
    var coord1 = (slice == SLICE_X) ? 1 : 0;
    var coord2 = (slice == SLICE_Z) ? 1 : 2;
    var i;
    for (i = 0; i != 4; i++) {
      verts[i*3+coord1] = (i > 1) ? 1 : -1;
      verts[i*3+coord2] = (i & 1) ? 1 : -1;
      verts[i*3+slice-SLICE_X] = sliceval;
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.extra);

  const aspectMatrix = mat4.create();
  var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  if (pos != undefined) {
    aspect = 1;
    gl.viewport(pos*100, 0, 100, 100);
  }
  mat4.scale(aspectMatrix, aspectMatrix, [Math.max(1, aspect), Math.max(1, 1/aspect), 1]);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(program.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(program.attribLocations.vertexPosition);
  gl.uniformMatrix4fv(program.uniformLocations.rotationMatrix, false, inverseRotationMatrix);
  gl.uniformMatrix4fv(program.uniformLocations.aspectMatrix, false, aspectMatrix);
  gl.uniformMatrix4fv(program.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(program.uniformLocations.modelViewMatrix,  false, viewMatrix);
  gl.uniform1f(program.uniformLocations.zoom, 20/zoom3d);
  var bright = brightnessBar.value;
  if (slice > SLICE_NONE) {
    bright *= 1.5;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
    //bright *= 64/sampleCount;
  gl.uniform1f(program.uniformLocations.brightness, Math.exp(bright/100));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, phaseTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1i(program.uniformLocations.phaseTexture, 0);
  gl.uniform2fv(program.uniformLocations.phases, phases);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.disableVertexAttribArray(program.attribLocations.vertexPosition);
  gl.disable(gl.BLEND);
}

function projectCoords(vec) {
  var pvec = vec4.create();
  vec3.copy(pvec, vec);
  pvec[3] = 1;
  vec4.transformMat4(pvec, pvec, viewMatrix);
  vec4.transformMat4(pvec, pvec, projectionMatrix);
  return [glCanvas.width *(.5+.5*pvec[0]/pvec[3]),
          glCanvas.height*(.5-.5*pvec[1]/pvec[3])];
}

function isFrontFacing(nx, ny, nz) {
  var vec = [0, 0, 6, 0];
  vec4.transformMat4(vec, vec, inverseRotationMatrix);
  return (nx-vec[0])*nx + (ny-vec[1])*ny + (nz-vec[2])*nz < 0;
}

function drawRadialFunction(ctx, canvas, fr, count, scaleVal) {
  var i;

  var maxsq = 0;
  var tot = 0;
  var vw = canvas.width;
  var vw2 = vw;
  var mid_x = Math.floor(vw/2);
  var zero = mid_x;

  for (i = 0; i != count; i++) {
    if (fr[i] > maxsq)
      maxsq = fr[i];
  }
  var bestscale = 1/maxsq;
  var scale = bestscale;

  var ymult2 = .90*canvas.height;
  var mid_y = canvas.height/2+ymult2/2;
  var mult = ymult2*scale;
  ctx.strokeStyle = "white";
  ctx.beginPath();
  var midi = Math.floor(count/2);
  var a0i = 0;
  for (i = 0; i != count; i++) {
    var x = mid_x + mid_x*(i-midi)/midi;
    var y = mid_y - (mult * fr[i]);
    if (i == 0)
      ctx.moveTo(x, y);
    else
      ctx.lineTo(x, y);
  }
  ctx.stroke();
  if (canvas.mouseX) {
    var x = canvas.mouseX;
    drawLine(ctx, 'yellow', x, 0, x, canvas.height);
    var i = (x-mid_x)*midi/mid_x+midi;
    selectText = "r = " + round(scaleVal*i/count) + " a<sub>0</sub>";
  }
  for (i = 0; i != count; i++) {
    var a0 = scaleVal*i/count;
    if (a0 >= a0i) {
      var x = mid_x + mid_x*(i-midi)/midi;
      drawLine(ctx, '#888', x, mid_y, x, mid_y+4);
      a0i++;
    }
  }
  drawLine(ctx, 'yellow', canvas.mouseX, 0, canvas.mouseX, canvas.height);
}

// draw edges of a cube (drawBack determines if we draw the edges in back or the ones in front)
function drawCube(gl, buffers, projectionMatrix, viewMatrix, drawBack) {
  gl.useProgram(colorPlainProgramInfo.program);
  const modelViewMatrix = mat4.create();
  mat4.copy(modelViewMatrix, viewMatrix);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.extra);

  var slice = sliceChooser.selectedIndex;
  var sliceIndex = 0;
  for (var i = 0; i != 6; i++) {
    var verts = []
    var pts = [0, 0, 0];
    for (var n = 0; n != 4; n++) {
      computeFace(i, n, pts);
      verts = verts.concat(pts);
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.vertexAttribPointer(colorPlainProgramInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorPlainProgramInfo.attribLocations.vertexPosition);
  
    gl.uniformMatrix4fv(colorPlainProgramInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(colorPlainProgramInfo.uniformLocations.modelViewMatrix,  false, modelViewMatrix);
    gl.uniform4f(colorPlainProgramInfo.uniformLocations.color, 1, 1, 1, 1);
    var nx = (i == 0) ? -1 : (i == 1) ? 1 : 0;
    var ny = (i == 2) ? -1 : (i == 3) ? 1 : 0;
    var nz = (i == 4) ? -1 : (i == 5) ? 1 : 0;
    if (isFrontFacing(nx, ny, nz) != drawBack)
      gl.drawArrays(gl.LINE_LOOP, 0, verts.length/3);
    if (!drawBack)
      continue;

    // draw edges of slice
    if (slice != SLICE_NONE && Math.floor(i/2) != slice-SLICE_X) {
      if (selectedSlice)
        gl.uniform4f(colorPlainProgramInfo.uniformLocations.color, 1, 1, 0, 1);
      var coord1 = (slice == SLICE_X) ? 1 : 0;
      var coord2 = (slice == SLICE_Z) ? 1 : 2;
      computeFace(i, 0, pts);
      pts[slice-SLICE_X] = sliceval;
      verts = [].concat(pts);
      var proj1 = projectCoords(pts);
      computeFace(i, 2, pts);
      pts[slice-SLICE_X] = sliceval;
      var proj2 = projectCoords(pts);
      verts = verts.concat(pts);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
      gl.drawArrays(gl.LINES, 0, 2);
      sliceFaces[sliceIndex++] = { edgeVerts: proj1.concat(proj2), normal: [nx, ny, nz] };
    }
  }
}

// generate the nth vertex of the bth cube face
function computeFace(b, n, pts) {
  // One of the 3 coordinates (determined by a) is constant.
  // When b=0, x=-1; b=1, x=+1; b=2, y=-1; b=3, y=+1; etc
  var a = b >> 1;
  pts[a] = ((b & 1) == 0) ? -1 : 1;

  // fill in the other 2 coordinates with one of the following
  // (depending on n): -1,-1; +1,-1; +1,+1; -1,+1
  var i;
  for (i = 0; i != 3; i++) {
    if (i == a) continue;
    pts[i] = (((n>>1)^(n&1)) == 0) ? -1 : 1;
    n >>= 1;
  }
}

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function zoom(x) {
  zoomRate = x
  if (x != 0)
    manualScale = true;
  refresh();
  updateStateLink();
}

class Complex {
  constructor(r, i) {
    if (r == undefined)
      this.re = this.im = this.mag = this.phase = 0;
    else {
      this.set(r, i);
    }
  }
  magSquared() { return this.mag*this.mag; }

  // takes (re, im) or (re) or (complex obj) as arguments
  set(aa, bb) {
    if (bb == undefined) {
      if (!isNaN(aa)) {
        this.re = aa; this.im = 0;
        this.updateMagPhase();
      } else {
        this.re = aa.re;
        this.im = aa.im;
        this.mag = aa.mag;
        this.phase = aa.phase;
      }
    } else {
      this.re = aa; this.im = bb;
      this.updateMagPhase();
    }
  }
  add(r, i) {
    if (isNaN(r)) {
      // add complex obj
      this.re += r.re;
      this.im += r.im;
      this.updateMagPhase();
      return;
    }
    this.re += r;
    if (i != undefined)
      this.im += i;
    this.updateMagPhase();
  }
  square() { this.set(this.re*this.re-this.im*this.im, 2*this.re*this.im); }
  mult2(c, d) { this.set(this.re*c-this.im*d, this.re*d+this.im*c); }
  mult(c) { if (isNaN(c)) { this.mult2(c.re, c.im); } else { this.re *= c; this.im *= c; this.mag *= c; } }
  conjugate() { this.im = -this.im; this.phase = -this.phase; }
  updateMagPhase() {
    this.mag = Math.sqrt(this.re*this.re+this.im*this.im);
    this.phase = Math.atan2(this.im, this.re);
  }
  setMagPhase(m, ph) {
    this.mag = m;
    this.phase = ph;
    this.re = m*Math.cos(ph);
    this.im = m*Math.sin(ph);
  }

  // advance phase by a
  rotate(a) {
    this.setMagPhase(this.mag, (this.phase+a) % (2*pi));
  }
};

class State extends Complex {
  getScaleRadius() {
    // set scale by solving equation Veff(r) = E, assuming m=0
    // Veff(r) = -1/r + l(l+1)/2, E = 1/2n^2
    const n = this.n;
    const l = this.l;
    const b0 = -n*n*2;
    const c0 = l*(l+1)*n*n;
    const r0 = .5*(-b0+Math.sqrt(b0*b0-4*c0));
    return r0;
  }

  getBrightness() {
    if (this.brightnessCache != 0 && this.brightnessCacheZoom == zoom3d)
      return this.brightnessCache;
    var avgsq = 0;
    var vol = 0;
    var i;
    var norm = radialNorm(this.n, this.l);
    const dataSize = 200;
    const resadj = (20/zoom3d)/dataSize;
    const n = this.n;
    const l = this.l;
    for (i = 0; i != dataSize; i++) {
      var r = i*resadj;
      var rho = 2*r/n;
      var rhol = Math.pow(rho, l)*norm;
      var val = confluentHypergeometricFunction(l+1-n, 2*l+2, rho)*rhol*Math.exp(-rho/2);
      val *= val;
      avgsq += val*val*i*i;
      vol += i*i;
    }
    this.brightnessCache = avgsq/vol;
    this.brightnessCacheZoom = zoom3d;
    return this.brightnessCache;
  }
}

// standard basis state (complex physics orbitals, Lz eigenstates, n,l,m)
class BasisState extends State {
  getText() { return "n = " + this.n + ", l = " + this.l + ", m = " + this.m; }
  setBasisActive() { }
  convertDerivedToBasis() { }
  convertBasisToDerived() { }
}

// derived states, expressed in a different basis
class DerivedState extends State {
  convertDerivedToBasis() { this.basis.convertDerivedToBasis(); }
  convertBasisToDerived() { this.basis.convertBasisToDerived(); }
  setBasisActive() { this.basis.active = true; }
  getText() { return this.text; }
}

// an alternate basis used to describe states
class AlternateBasis {
  constructor() {
    basisList[basisCount++] = this;
  }

  // convert derived states in this alternate basis to (standard) basis states
  // clear defaults to false
  convertDerivedToBasis(clear) {
    var i, j;
    if (clear != false)
      for (i = 0; i != stateCount; i++)
        states[i].set(0);
    var c = new Complex();
    for (i = 0; i != this.altStateCount; i++) {
      var ds = this.altStates[i];
      for (j = 0; j != ds.count; j++) {
        c.set(ds.coefs[j]);
        c.conjugate();
        c.mult(ds);
        ds.bstates[j].add(c);
      }
    }
    var maxm = 0;
    for (i = 0; i != stateCount; i++)
      if (states[i].mag > maxm)
        maxm = states[i].mag;
    if (maxm > 1) {
      var mult = 1/maxm;
      for (i = 0; i != stateCount; i++)
        states[i].mult(mult);
    }
  }

  // convert states in standard basis to this derived basis
  convertBasisToDerived() {
    var i, j;
    var c1 = new Complex();
    var c2 = new Complex();
    var maxm = 0;
    for (i = 0; i != this.altStateCount; i++) {
      var ds = this.altStates[i];
      c1.set(0);
      for (j = 0; j != ds.count; j++) {
        c2.set(ds.coefs[j]);
        c2.mult(ds.bstates[j]);
        c1.add(c2);
      }
      if (c1.mag < 1e-8)
        c1.set(0);
      ds.set(c1);
      if (c1.mag > maxm)
        maxm = ds.mag;
    }
    if (maxm > 1) {
      var mult = 1/maxm;
      for (i = 0; i != this.altStateCount; i++)
        this.altStates[i].mult(mult);
    }
  }
}

class Phasor {
  constructor(x, y, a, b) {
    this.x = x;
    this.y = y;
    this.width = a;
    this.height = b;
  }
  inside(x, y) {
    return x >= this.x && y >= this.y && x < this.x+this.width && y < this.y+this.height;
  }
}

class TextBox {
  constructor(x, y, a, b, s) {
    this.x = x;
    this.y = y;
    this.width = a;
    this.height = b;
    this.text = s;
  }
}

window.onload = main
