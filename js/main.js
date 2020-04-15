//Scriptsheet by Shujin Wang, 2020
//wrap everything in a self-executing anonymous function to move to local scope
(function(){
//pseudo-global variables for data join
var attrArray = ["Hospital Beds", "Mar 25th Incidence Rate", "Mar 25th Death Rate", "Apr 1st Incidence Rate", "Apr 1st Death Rate", "Apr 15th Incidence Rate", "Apr 15th Death Rate"]; //list of attributes
var domain = {"Hospital Beds": 5.5, "Mar 25th Incidence Rate": 3.5, "Mar 25th Death Rate": 120, "Apr 1st Incidence Rate": 7, "Apr 1st Death Rate": 150, "Apr 15th Incidence Rate": 12.5, "Apr 15th Death Rate": 155}
var title = {"Hospital Beds": "Number of Hospital Beds per 1000 People",
             "Mar 25th Incidence Rate": "Number of COVID-19 Cases per 1000 people on Mar 25th",
             "Mar 25th Death Rate": "Number of Deaths per 1000 Cases of COVID-19 on Mar 25th",
             "Apr 1st Incidence Rate": "Number of COVID-19 Cases per 1000 people on Apr 1st",
             "Apr 1st Death Rate": "Number of Deaths per 1000 Cases of COVID-19 on Apr 1st",
             "Apr 15th Incidence Rate": "Number of COVID-19 Cases per 1000 people on Apr 15th",
             "Apr 15th Death Rate": "Number of Deaths per 1000 Cases of COVID-19 on Apr 15th"}
var expressed = attrArray[2]; //initial attribute

//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 460;

//create a scale to size bars proportionally to frame
var yScale = d3.scaleLinear()
    .range([0, chartHeight])
    .domain([0, domain[expressed]]);

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on Spain
    var projection = d3.geoAlbers()
        .center([0, 40])
        .rotate([3, 0, 0])
        .parallels([38, 42])
        .scale(2500)
        .translate([width / 2, height / 2]);
    var path = d3.geoPath()
        .projection(projection);

    //create Albers equal area conic projection centered on Canary Islands
    var projection2 = d3.geoAlbers()
        .center([0, 28.3])
        .rotate([15.9, 0, 0])
        .parallels([28, 28.6])
        .scale(3500)
        .translate([350 / 2, 200 / 2]);
    var path2 = d3.geoPath()
        .projection(projection2);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];
    promises.push(d3.csv("data/unitsData.csv")); //load attributes from csv
    promises.push(d3.json("data/otherCountries.topojson")); //load background spatial data
    promises.push(d3.json("data/SpainRegions.topojson")); //load choropleth spatial data
    Promise.all(promises).then(callback);

    function callback(data){
      	csvData = data[0];
        other = data[1];
      	spain = data[2];

        //place graticule on the map
        setGraticule(map, path, 5);

        //translate other countries and spain TopoJSONs
        var otherCountries = topojson.feature(other, other.objects.ne_10m_admin_0_countries);
        var spainRegions = topojson.feature(spain, spain.objects.ESP_adm1).features;

        //add other countries to map
        var countries = map.append("path")
            .datum(otherCountries)
            .attr("class", "countries")
            .attr("d", path);

        //join csv data to GeoJSON enumeration units
        spainRegions = joinData(spainRegions, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(spainRegions, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);

        //create new svg container for Canary Islands, place graticule and add enumeration units
        var map2 = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", 350)
            .attr("height", 200);
        setGraticule(map2, path2, 2);
        setEnumerationUnits(spainRegions, map2, path2, colorScale);

        createDropdown(csvData);

        var infotext = d3.select("body")
            .append("div")
            .attr("class", "infotext")
            .html("The COVID-19 was confirmed to have spread to Spain on Jan 31st 2020, when a German tourist tested positive on Canary Islands. By 13 March, cases had been registered in all 50 provinces of the country. A state of alarm and national lockdown was imposed on 14 March. By late March, the Community of Madrid has recorded the most cases and deaths in the country. Medical professionals and those who live in retirement homes have experienced especially high infection rates. On 25 March 2020, the death toll in Spain surpassed that reported in mainland China and only Italy had a higher death toll globally. On 2 April, 950 people died of the virus in a 24-hour period—at the time, the most by any country in a single day. As of 15 April 2020, there have been 177,644 confirmed cases with 70,853 recoveries and 18,708 deaths in Spain. The actual number of cases, however, is likely to be much higher, as many people with only mild or no symptoms are unlikely to have been tested.")
    };
};

function setGraticule(map, path, n){
    //create graticule generator
    var graticule = d3.geoGraticule()
        .step([n, n]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

function joinData(spainRegions, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvRegion = csvData[i]; //the current region
        var csvKey = csvRegion.NAME_1; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<spainRegions.length; a++){
            var geojsonProps = spainRegions[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.NAME_1; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){
                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };
    return spainRegions;
};

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#ffe1b0",
        "#fdcc8a",
        "#fc8d59",
        "#e34a33",
        "#b30000"
    ];

    //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};

function setEnumerationUnits(spainRegions, map, path, colorScale){
    //add Spain regions to map
    var regions = map.selectAll(".regions")
        .data(spainRegions)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "regions " + d.properties.NAME_1;
        })
        .attr("d", path)
        .style("fill", function(d){
            var value = d.properties[expressed];
            if(value) {
            	return colorScale(value);
            } else {
            	return "#ccc";
            }
        })
        .on("mouseover", function(d){
            highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

    var desc = regions.append("desc")
        .text('{"stroke": "black", "stroke-width": "0.5px"}');
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //set bars for each region
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        })
        .attr("class", function(d){
            return "bars " + d.NAME_1;
        })
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);

    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 20)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Number of Deaths per 1000 Cases of COVID-19 on Mar 25th");

    //annotate bars with attribute value text
    var numbers = chart.selectAll(".numbers")
        .data(csvData)
        .enter()
        .append("text")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        })
        .attr("class", function(d){
            return "numbers";
        });

    //set bar positions, heights, colors and annotations
    updateChart(bars, csvData.length, colorScale, numbers);
};

//function to position, size, color, and annotate bars in chart
function updateChart(bars, n, colorScale, numbers){
    //position bars
    bars.attr("width", chartWidth / n - 1)
        .attr("x", function(d, i){
            return i * (chartWidth / n);
        })
        //size/resize bars
        .attr("height", function(d){
            return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed]));
        })
        //color/recolor bars
        .style("fill", function(d){
            var value = d[expressed];
            if(value) {
                return colorScale(value);
            } else {
                return "#ccc";
            }
        });

    //annotate bars
    numbers.attr("text-anchor", "middle")
        .attr("x", function(d, i){
            var fraction = chartWidth / n;
            return i * fraction + (fraction - 1) / 2;
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed])) + 15;
        })
        .text(function(d){
            return parseFloat(d[expressed]).toFixed(1);
        });
};

//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};

//dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var regions = d3.selectAll(".regions")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            var value = d.properties[expressed];
            if(value) {
            	return colorScale(value);
            } else {
            	return "#ccc";
            }
    });

    //change the scale to size bars proportionally to frame
    yScale = d3.scaleLinear()
        .range([0, chartHeight])
        .domain([0, domain[expressed]]);

    //re-sort, resize, recolor, and annotate bars
    var bars = d3.selectAll(".bars")
        .sort(function(a, b){
            return a[expressed] - b[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);
    var numbers = d3.selectAll(".numbers")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        });
    updateChart(bars, csvData.length, colorScale, numbers);

    //change the text element for the chart title
    var chartTitle = d3.select("text")
        .text(title[expressed]);
};

//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.NAME_1)
        .style("stroke", "black")
        .style("stroke-width", "2");
    setLabel(props);
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.NAME_1)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };

    //remove info label
    d3.select(".infolabel")
        .remove();
};

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.NAME_1 + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.NAME_1);
};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
})();
