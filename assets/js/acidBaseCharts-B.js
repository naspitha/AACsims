var svg = d3.select("#simulationB-svg"),
margin = 80,
topmargin = 20
width = svg.attr("width"),
height = svg.attr("height");

var playButton = d3.select("#play-button"),
inputHA = document.getElementById("cHA-value"),
inputA = document.getElementById("cA-value"),
logScaleButton = d3.select("#logScaleCB")

var simRate=10
var time_unit = 1e-3
var timepoints = 500
var conc_unit = 1e-3
var HAi = +(inputHA.value)*conc_unit, Ai=+(inputA.value)*conc_unit
var H3Oi = 1e-7, OHi = 1e-7
var F = HAi + Ai
var HAOld = HAi, AOld=Ai, H3OOld = H3Oi, OHOld = OHi
var tOld=0, dt=1e-4;
var HANew, ANew, tNew, H3ONew, OHNew
const Kw = 1e-14
const Ka = 1.8e-5
const Kb = Kw/Ka
var kF = 0.5, kR = kF/Ka
// var kFb = kF*Kb/Ka, kRb = kFb/Kb
var kFb = 0, kRb = 0
var xy = [{"t":tOld, "cHA":HAOld, "cA": AOld, "cH3O":H3OOld, "cOH":OHOld}]
var addedBaseAmt = 0 // in moles/L
var baseAdded=false
var addingBaseNow=false
var logScaleOn = true

var keys = ["HA", "A", "H3O", "OH", "pH"]
var color = d3.scaleOrdinal()
    .domain(keys)
    .range(["rgb(0, 204, 204)", "rgb(0, 127.5, 204)", "rgb(30, 30, 30)", "rgb(204, 0, 0)", "orange"]);
var properName = d3.scaleOrdinal()
    .domain(keys)
    .range(["[HA]", "[A-]", "[H3O+]", "[OH-]", "pH"])

svg.append("rect")
    .attr("x",margin)
        .attr("y",topmargin)
        .attr("height", height-margin-topmargin)
        .attr("width", width-2*margin)
        .attr("fill", "white")        

rect = svg.append("rect")
    .attr("x",margin)
        .attr("y",topmargin)
        .attr("height", height-margin-topmargin)
        .attr("width", width-2*margin)
        .attr("fill", "red") 
        .attr("opacity", 0)

var xScale = d3.scaleLinear()
    .domain([0, dt/time_unit])
    .range([margin, width-margin])

var yScale = d3.scaleLog()
    .domain([1e-7/conc_unit*0.6, F/conc_unit*5])
    .range([height-margin, topmargin])
    .clamp(true);

var pHScale = d3.scaleLinear()
    .domain([0, 14])
    .range([height-margin, topmargin])
    .clamp(true)

var x_axis = d3.axisBottom()
        .scale(xScale);

var y_axis = d3.axisLeft()
        .scale(yScale)
        .ticks(10, formatPower)

var pH_axis = d3.axisRight()
        .scale(pHScale)
        

svg.append("g")
        .attr("transform", "translate(0," + (height-margin)+")")
        .attr("id", "xaxis")
        .call(x_axis)
svg.append("g")
    .attr("transform", "translate("+margin+",0)")
    .attr("id", "yaxis")
    .call(y_axis);
pHAxis = svg.append("g")
    .attr("transform", "translate("+(width-margin+12)+", 0)")
    .attr("id", "pHaxis")
    .call(pH_axis)
pHAxis.selectAll("text").style("fill", "orange").style("font-weight", 600)
pHAxis.selectAll("path").style("stroke", "orange").style("stroke-width", "1.5")
pHAxis.selectAll("line").style("stroke", "orange").style("stroke-width", "1.5")


// Add X axis label:
svg.append("text")
    .attr("text-anchor", "middle")
    .attr("x", width/2)
    .attr("y", height-margin/2)
    .text("Zeit (ms)");

// Y axis label:
svg.append("text")
    .attr("x", margin/2)
    .attr("y", (height-margin)/2)
    .attr("transform", "rotate(-90,"+margin/2+","+(height-margin)/2+")")
    .attr("text-anchor", "middle")
    .text("Konzentration (mmol/L)")

// pH axis label:
svg.append("text")
    .attr("x", width-margin/2+10)
    .attr("y", height/2-margin/2)
    .attr("id", "pHlabel")
    .attr("fill", "orange")
    .attr("font-weight", 700)
    .attr("text-anchor", "middle")
    .text("pH")

pathHA = svg.append("path")
        .datum(xy)
        .attr("fill", "none")
        .attr("stroke", color("HA"))
        .attr("stroke-width", 2)
        .attr("id", keys[0]+"_line")
        .attr("visibility", "visible")
        // .attr("transform", "translate("+margin+","+margin+")")
        .attr("d", d3.line()
            .x(function(d) {return xScale(d.t/time_unit)})
            .y(function(d) {return yScale(d.cHA/conc_unit)})
            )

pathA = svg.append("path")
        .datum(xy)
        .attr("fill", "none")
        .attr("stroke", color("A"))
        .attr("stroke-width", 2)
        .attr("id", keys[1]+"_line")
        .attr("visibility", "visible")
        // .attr("transform", "translate("+margin+","+margin+")")
        .attr("d", d3.line()
            .x(function(d) {return xScale(d.t/time_unit)})
            .y(function(d) {return yScale(d.cA/conc_unit)})
            )

pathH3O = svg.append("path")
    .datum(xy)
    .attr("fill", "none")
    .attr("stroke", color("H3O"))
    .attr("stroke-width", 3)
    .style("stroke-dasharray", ("3, 5"))
    .attr("id", keys[2]+"_line")
    .attr("visibility", "visible")
    // .attr("transform", "translate("+margin+","+margin+")")
    .attr("d", d3.line()
        .x(function(d) {return xScale(d.t/time_unit)})
        .y(function(d) {return yScale(d.cH3O/conc_unit)})
        )

pathOH = svg.append("path")
        .datum(xy)
        .attr("fill", "none")
        .attr("stroke", color("OH"))
        .attr("stroke-width", 3)
        .style("stroke-dasharray", ("3, 5"))
        .attr("id", keys[3]+"_line")
        .attr("visibility", "visible")
        // .attr("transform", "translate("+margin+","+margin+")")
        .attr("d", d3.line()
            .x(function(d) {return xScale(d.t/time_unit)})
            .y(function(d) {return yScale(d.cOH/conc_unit)})
            )

pathPH = svg.append("path")
        .datum(xy)
        .attr("fill", "none")
        .attr("stroke", color("pH"))
        .attr("stroke-width", 5)
        .attr("opacity", .5)
        .attr("id", "pH_line")
        .attr("visibility", "visible")
        // .attr("transform", "translate("+margin+","+margin+")")
        .attr("d", d3.line()
            .x(function(d) {return xScale(d.t/time_unit)})
            .y(function(d) {var pH = -Math.log10(d.cH3O)
                return pHScale(pH)})
            )

// Legend
var longestText = properName(keys.reduce(
    function (pv, cv) {
        if (properName(cv).length > properName(pv).length){
            return cv
        } else {
            return pv
        };
    }, ""
));
svg.append("text").attr("id", "dummyText").text(longestText).style("visibility", "hidden")
var dummyText = d3.select("#dummyText").node()
var textLength = dummyText.getComputedTextLength()
var radius = 7
var legx2 = (width-margin)*0.98
var legx1 = legx2-5.5*radius-textLength
var legy1 = height*0.02+topmargin
var legy2 = legy1+radius+keys.length*25

var legend = svg.append("g")
    .attr("id", "legend")
legend.append("rect")
    .attr("x",legx1)
    .attr("y",legy1)
    .attr("height", legy2-legy1)
    .attr("width", legx2-legx1)
    .style("fill", "rgb(254, 254, 254)")
    .attr("stroke", "gray")
    .style("opacity", 0.9)
legend.selectAll("mydots")
    .data(keys)
    .enter()
    .append("circle")
        .attr("cx", legx2-2*radius)
        .attr("cy", function(d,i){ return legy1 + 2*radius + i*25})
        .attr("r", radius)
        .attr("id", function(d, i){return keys[i]+"_dot"})
        .style("fill", function(d, i){ return color(d)})
        .style("stroke", function(d){ return color(d)})
        .on("click", function(d, i){
            lineID = "#"+keys[i]+"_line"
            dotID = "#"+this.id
            var active = d3.select(lineID).style("visibility")
            if (active == "visible"){
                d3.select(lineID).style("visibility", "hidden")
                d3.select(dotID).style("fill", "white")
            } else {
                d3.select(lineID).style("visibility", "visible")
                d3.select(dotID).style("fill", color(d))
            }
        })
legend.selectAll("mylabels")
    .data(keys)
    .enter()
    .append("text")
        .attr("id", function(d){return d+"_d"})
        .attr("x", legx2-4*radius)
        .attr("y", function(d,i){ return legy1 + 2*radius + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
        .style("fill", "rgb(88, 88, 88)")
        .style("font-weight", "600")
        .text(function(d){ return properName(d)})
        .attr("text-anchor", "end")
        .style("alignment-baseline", "middle")
        .on("click", function(d, i){
            lineID = "#"+keys[i]+"_line"
            dotID = "#"+this.id+"ot"
            var active = d3.select(lineID).style("visibility")
            if (active == "visible"){
                d3.select(lineID).style("visibility", "hidden")
                d3.select(dotID).style("fill", "white")
            } else {
                d3.select(lineID).style("visibility", "visible")
                d3.select(dotID).style("fill", color(d))
            }
        })

var running = false
function drawPoint() {      
    tNew = tOld + dt
    if (addingBaseNow){
        baseAmt = addedBaseAmt
        if (baseAmt>HAOld){
            // all of HA converted to A
            HANew = 0
            ANew = AOld + HAOld
            baseAmt -= HAOld
            OHNew = OHOld + baseAmt
            H3ONew = Kw/OHNew
        } else {
            // all of the added base consumed
            HANew = HAOld - baseAmt
            ANew = AOld + baseAmt
            OHNew = OHOld
            H3ONew = H3OOld
        }
    } else {
        HANew = HAOld + dt*(-kF*HAOld + kR*AOld*H3OOld + kFb*AOld - kRb*HAOld*OHOld)
        ANew =  F-HANew
        H3ONew = H3OOld + dt*(kF*HAOld - kR*AOld*H3OOld)
        OHNew = OHOld + dt*(kFb*AOld - kRb*HAOld*OHOld)
        //adjusting for Kw
        var a =  H3ONew, b=OHNew
        var e = ((a+b) - Math.sqrt((a-b)**2+4*Kw))/2
        H3ONew -= e; OHNew -= e
    }

    
    xy.push({"t": tNew, "cHA": HANew, "cA":ANew, "cH3O":H3ONew, "cOH":OHNew})
    tOld = tNew; HAOld = HANew; AOld = ANew; H3OOld=H3ONew; OHOld = OHNew

    xScale.domain([0,tNew/time_unit])
    x_axis.scale(xScale)
    svg.select("#xaxis").call(x_axis)

    rePlot()

    
    // end of solution-making:
    if (tNew >= (timepoints-1)*dt && !baseAdded){
        running = false
        toggleCursor()
        clearInterval(timer)
        inputHA.disabled=false
        inputA.disabled=false
        playButton.text("Restart")

    } else {
        if (tNew >= (3*timepoints-1)*dt && baseAdded){
            running = false
            toggleCursor()
            clearInterval(timer)
            inputHA.disabled=false
            inputA.disabled=false
            playButton.text("Restart")
        }
    }
};

var curVis = "hidden"
// cursor with x and y values
x0 = 0.05*width+margin; y0 = 0.05*height+topmargin
cursor = svg.append("g")
cursor.attr("id", "cursor").attr("visibility", curVis)
cursor.append("line")
    .style("stroke", "rgb(88,88,88)")
    .style("stroke-width", 1.5)
    .attr("x1", x0+10).attr("x2", x0-10)
    .attr("y1", y0).attr("y2", y0)
    .attr("id", "yCur")
cursor.append("line")
    .style("stroke", "rgb(88,88,88)")
    .style("stroke-width", 1.5)
    .attr("x1", x0).attr("x2", x0)
    .attr("y1", y0+10).attr("y2", y0-10)
    .attr("id", "xCur")
cursor.append("text")
    .style("stroke", "rgb(88,88,88)")
    .attr("id", "coord")
    .attr("x", x0+10).attr("y", y0-10)
    .text("Tippe irgendwo, um X und Y anzuzeigen")

rect.on("click", function(){
    if (curVis == "visible"){
        var xval = d3.mouse(this)[0]
        var yval = d3.mouse(this)[1]
        d3.select("#xCur").attr("x1", xval).attr("x2", xval)
        d3.select("#xCur").attr("y1", yval-10).attr("y2", yval+10)
        d3.select("#yCur").attr("y1", yval).attr("y2", yval)
        d3.select("#yCur").attr("x1", xval-10).attr("x2", xval+10)
        curX =  xScale.invert(xval); curY = yScale.invert(yval)
        curpH = pHScale.invert(yval)
        d3.select("#coord").text("("+curX.toFixed(2) + " ms , "+curY.toExponential(1)+" M, pH = "+curpH.toFixed(2)+")")
        if(xval<width/2){
            d3.select("#coord")
                .attr("x", xval+10)
                .attr("text-anchor", "start")}
            else{d3.select("#coord")
                            .attr("x", xval-10)
                            .attr("text-anchor", "end")}
        if(yval<height/2){
            d3.select("#coord").attr("y", yval+20)}
            else{d3.select("#coord").attr("y", yval-10)} 
    } 
})

playButton.on("click", function(){
    if (playButton.text() == "Pause"){
        running = false
        clearInterval(timer);
        toggleCursor()
        playButton.text("Resume")
        
    } else {
        if (playButton.text()=="Restart" || playButton.text()=="Run"){
            if (playButton.text()=="Restart"){
                toggleCursor()
            }

            setTimeout(function(){
                Reset()
                running = true
                inputHA.disabled=true
                inputA.disabled=true
                timer = setInterval(drawPoint, simRate)
                playButton.text("Pause")
            }, 0)
        } else{
            running = true
            toggleCursor()
            inputHA.disabled=true
            inputA.disabled=true
            timer = setInterval(drawPoint, simRate)
            playButton.text("Pause")
        }
        
    }
})

logScaleButton.on("click", function(){
    console.log(logScaleOn)
    if (logScaleOn){makeYScaleLinear()}
    else {makeYScaleLog()}
})

d3.select("#cHA-value").on("input", function(){
    updateHA(this.value*conc_unit)
})
d3.select("#cA-value").on("input", function(){
    updateA(this.value*conc_unit)
})

function toggleCursor(){
    if(curVis=="visible"){
        curVis="hidden"
        cursor.attr("visibility", "hidden")
    }
    else{
        if(curVis == "hidden"){
            curVis = "visible"
            rect.raise()
            legend.raise()
            d3.select("#xCur")
            .attr("x1", x0+10).attr("x2", x0-10)
            .attr("y1", y0).attr("y2", y0)
            d3.select("#yCur")
            .attr("x1", x0).attr("x2", x0)
            .attr("y1", y0+10).attr("y2", y0-10)
            cursor.attr("visibility", "visible")
            d3.select("#coord")
            .attr("x", x0+10).attr("y", y0-10)
            .text("Tippe irgendwo, um X und Y anzuzeigen")
            .attr("text-anchor", "start")
        }
    }
    
}

function Reset(){
    running = false
    baseAdded=false
    HAOld = HAi; AOld = Ai; H3OOld = H3Oi; OHOld = OHi
    tOld = 0; tNew = 0
    F = HAi + Ai
    xy = [{"t":tOld, "cHA":HAOld, "cA": AOld, "cH3O":H3OOld, "cOH":OHOld}]
    // HANew = HAi/2; ANew = Ai; H3ONew = H3Oi; OHNew = OHi;
    pathHA.datum(xy); pathA.datum(xy); pathH3O.datum(xy); pathOH.datum(xy)
    pathPH.datum(xy)
    if (logScaleOn){
        yScale.domain([1e-7/conc_unit*0.6, F/conc_unit*5])
    } else {
        yScale.domain([0, F/conc_unit*1.2])
    }
    
    y_axis.scale(yScale)
    svg.select("#yaxis").call(y_axis)
}

function updateHA(value){
    HAi = value
}

function updateA(value){
    Ai = value
}

function formatPower(x) {
    const e = Math.log10(x);
    if (e !== Math.floor(e)) return; // Ignore non-exact power of ten.
    return `10${(e + "").replace(/./g, c => "⁰¹²³⁴⁵⁶⁷⁸⁹"[c] || "⁻")}`;
  }

function makeYScaleLinear(){
    yScale = d3.scaleLinear()
    .domain([0, F/conc_unit*1.2])
    .range([height-margin, topmargin]) 
    y_axis.scale(yScale).ticks(12)
    svg.select("#yaxis").call(y_axis)
    rePlot()
    logScaleOn = false
}
function makeYScaleLog(){
    yScale = d3.scaleLog()
    .domain([1e-7/conc_unit*0.6, F/conc_unit*5])
    .range([height-margin, topmargin])
    .clamp(true);
    y_axis.scale(yScale).ticks(10, formatPower)
    svg.select("#yaxis").call(y_axis)
    rePlot()
    logScaleOn = true
}
function rePlot(){
    pathHA.attr("d", d3.line()
    .x(function(d) {return xScale(d.t/time_unit)})
    .y(function(d) {return yScale(d.cHA/conc_unit)})
    ) 
    pathA.attr("d", d3.line()
            .x(function(d) {return xScale(d.t/time_unit)})
            .y(function(d) {return yScale(d.cA/conc_unit)})
            )
    pathH3O.attr("d", d3.line()
    .x(function(d) {return xScale(d.t/time_unit)})
    .y(function(d) {return yScale(d.cH3O/conc_unit)})
    )
    pathOH.attr("d", d3.line()
    .x(function(d) {return xScale(d.t/time_unit)})
    .y(function(d) {return yScale(d.cOH/conc_unit)})
    )

    pathPH.attr("d", d3.line()
    .x(function(d) {return xScale(d.t/time_unit)})
    .y(function(d) {var pH = -Math.log10(d.cH3O)
        
        return pHScale(pH)})
    )
}
