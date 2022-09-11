//TODO: make size of graph responsive
//TODO: make bring cross to front
//TODO: zoom
//TODO:  set the dimensions and margins of the graph
var margin = {top: 10, right: 30, bottom: 40, left: 50}

var width = 520 - margin.left - margin.right
var height = 400 - margin.top - margin.bottom;

//info for legend
var legx = width*0.93
var legy = height*0.04
var legx1 = legx-17
var legx2 = width*1.04
var legy1 = 0
var legy2 = 0.58*height 

// append the svg object to the body of the page
var svg = d3.select("#simulationA")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
        "translate(" + margin.left + "," + margin.top + ")")
    

// Add the grey background that makes ggplot2 famous
svg
    .append("rect")
    .attr("x",0)
    .attr("y",0)
    .attr("height", height)
    .attr("width", width)
    .style("fill", "white")
    .on("click", function(){
        var xval = d3.mouse(this)[0]
        var yval = d3.mouse(this)[1]
        xwithinbox = xval>legx1 && xval<legx2
        ywithinbox = yval>legy1 && yval<legy2
        withinbox = xwithinbox && ywithinbox
        console.log(withinbox)
        if (!withinbox){
            d3.select("#xCur").attr("x1", xval).attr("x2", xval)
            d3.select("#xCur").attr("y1", yval-10).attr("y2", yval+10)
            d3.select("#yCur").attr("y1", yval).attr("y2", yval)
            d3.select("#yCur").attr("x1", xval-10).attr("x2", xval+10)
            curX = x.invert(xval); curY = y.invert(yval)
            d3.select("#coord").text("("+curX.toFixed(1) + ", "+curY.toFixed(1)+")")
            d3.select("#coord").attr("visibility", "visible")
            
            if(xval<width/2){
                d3.select("#coord")
                    .attr("x", xval+10)
                    .attr("text-anchor", "start")}
                else{d3.select("#coord")
                                .attr("x", xval-10)
                                .attr("text-anchor", "end")}
            if(y<height/2){
                d3.select("#coord").attr("y", yval+20)}
                else{d3.select("#coord").attr("y", yval-10)}
        }
        
    })
//Add X axis
var x = d3.scaleLog()
    .domain([40000, 0.9])
    .range([ 0, width ])
var xAxis = d3.axisBottom(x)
    .tickValues([1, 10, 100, 1000, 10000])
    .tickFormat((d, i) => ['1', '10', '100', '1000', '10000'][i])
svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis)
    .select(".domain").remove()

// Add Y axis
var y = d3.scaleLinear()
        .domain([-0.05, 11.5])
        .range([ height, 0])
        //.nice()
svg.append("g")
    .call(d3.axisLeft(y).tickSize(-width*1.3).ticks(7))
    .select(".domain").remove()

// Customization
svg.selectAll(".tick line").attr("stroke", "lightgray")

// Add X axis label:
svg.append("text")
    .attr("text-anchor", "end")
    .attr("x", width/2 + margin.left)
    .attr("y", height + margin.top + 25)
    .text("Ionisierungsenergie (eV)");

// Y axis label:
svg.append("text")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 20)
    .attr("x", -margin.top - height/2 + 20)
    .text("Intensität")

// cross with x and y values
x0 = 0.05*width; y0 = 0.05*height
svg.append("line")
    .style("stroke", "black")
    .style("stroke-width", 1.5)
    .attr("x1", x0+10).attr("x2", x0-10)
    .attr("y1", y0).attr("y2", y0)
    .attr("id", "yCur")
svg.append("line")
    .style("stroke", "black")
    .style("stroke-width", 1.5)
    .attr("x1", x0).attr("x2", x0)
    .attr("y1", y0+10).attr("y2", y0-10)
    .attr("id", "xCur")
svg.append("text")
    .style("stroke", "black")
    .attr("id", "coord")
    .attr("x", x0+10).attr("y", y0+20)
    .text("Tippe irgendwo, um X und Y anzuzeigen")
    //.attr("visibility", "hidden")

//Read the data
d3.csv("/files/plotPES.csv", function(data) {
    // Color scale
    var keys = ["H", "He", "Li", "U1", "U2", "U3", "U4", "U5"]
    var color = d3.scaleOrdinal()
        .domain(keys)
        .range(["#619CFF", "orange", "blue", "#F8766D", "#00BA38", "brown", "violet", "gray"]);

// Add plots
svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color("H"))
    .attr("stroke-width", 1.5)
    .attr("id", "H_line")
    .attr("visibility", "visible")
    .attr("d", d3.line()
        .x(function(d) { return x(d.eV) })
        .y(function(d) { return y(d.H) })
        )
svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color("He"))
    .attr("stroke-width", 1.5)
    .attr("id", "He_line")
    .attr("visibility", "hidden")
    .attr("d", d3.line()
        .x(function(d) { return x(d.eV) })
        .y(function(d) { return y(d.He) })
        )
svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color("Li"))
    .attr("stroke-width", 1.5)
    .attr("id", "Li_line")
    .attr("visibility", "hidden")
    .attr("d", d3.line()
        .x(function(d) { return x(d.eV) })
        .y(function(d) { return y(d.Li) })
        )
svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color("U1"))
    .attr("stroke-width", 1.5)
    .attr("id", "U1_line")
    .attr("visibility", "hidden")
    .attr("d", d3.line()
        .x(function(d) { return x(d.eV) })
        .y(function(d) { return y(d.U1) })
        )
svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color("U2"))
    .attr("stroke-width", 1.5)
    .attr("id", "U2_line")
    .attr("visibility", "hidden")
    .attr("d", d3.line()
        .x(function(d) { return x(d.eV) })
        .y(function(d) { return y(d.U2) })
        )
svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color("U3"))
    .attr("stroke-width", 1.5)
    .attr("id", "U3_line")
    .attr("visibility", "hidden")
    .attr("d", d3.line()
        .x(function(d) { return x(d.eV) })
        .y(function(d) { return y(d.U3) })
        )
svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color("U4"))
    .attr("stroke-width", 1.5)
    .attr("id", "U4_line")
    .attr("visibility", "hidden")
    .attr("d", d3.line()
        .x(function(d) { return x(d.eV) })
        .y(function(d) { return y(d.U4) })
        )
svg.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color("U5"))
    .attr("stroke-width", 1.5)
    .attr("id", "U5_line")
    .attr("visibility", "hidden")
    .attr("d", d3.line()
        .x(function(d) { return x(d.eV) })
        .y(function(d) { return y(d.U5) })
        )

// Legend
svg.append("rect")
    .attr("x",legx1)
    .attr("y",legy1)
    .attr("height", legy2-legy1)
    .attr("width", legx2-legx1)
    .style("fill", "white")
    .style("stroke", "black")
svg.selectAll("mydots")
    .data(keys)
    .enter()
    .append("circle")
        .attr("cx", legx)
        .attr("cy", function(d,i){ return legy + i*25}) // legy is where the first dot appears. 25 is the distance between dots
        .attr("r", 7)
        .attr("id", function(d, i){return keys[i]+"_dot"})
        .style("fill", function(d, i){
            if (keys[i] != "H"){return "white"}else{return color("H")}})
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


// Add one dot in the legend for each name.
svg.selectAll("mylabels")
    .data(keys)
    .enter()
    .append("text")
        .attr("x", legx+20)
        .attr("y", function(d,i){ return legy + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
        .style("fill", "black")
        .text(function(d){ return d})
        .attr("text-anchor", "left")
        .style("alignment-baseline", "middle")
});
