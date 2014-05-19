// visualizer.js

// taken from http://stackoverflow.com/a/17243070/3487515
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (h && s === undefined && v === undefined) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.floor(r * 255),
        g: Math.floor(g * 255),
        b: Math.floor(b * 255)
    };
}

// taken from http://jsfiddle.net/hiddenloop/tpejt/
// calculates standard deviation for me :P
average = function(a) {
  var r = {mean: 0, variance: 0, deviation: 0}, t = a.length;
  for(var m, s = 0, l = t; l--; s += a[l]);
  for(m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(a[l] - m, 2));
  return r.deviation = Math.sqrt(r.variance = s / t), r;
}

function init() {
    var context = new webkitAudioContext();
    var audioElement = document.getElementById("player");
    var source = context.createMediaElementSource(audioElement);

    // create AnalyzerNode
    var analyser = context.createAnalyser();
    analyser.fftSize = 256;

    // route the source
    source.connect(analyser);
    analyser.connect(context.destination);

    // create array to hold real-time fast fourier transform data
    var frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    // EASELJS Stuff
    // set up canvas-related objects
    var stage = new createjs.Stage("visualizerCanvas");
    stage.autoClear = true;

    var hue_shift = 0;

    var max_bg_blip_counter = 15;
    var bg_blip_counter = 0;
    var bg_blip = new createjs.Shape();
    stage.addChild(bg_blip);

    // colored vertical bars
    var bin_bars = [];
    var bar_width = stage.canvas.width / analyser.frequencyBinCount;
    for (var i = 0; i < frequencyData.length; i++) {
        var x = bar_width * i;
        var y = 0;
        var rect = new createjs.Shape();
        var color = HSVtoRGB((hue_shift + i / frequencyData.length) % 1, 1.0, 1.0);
        rect.graphics.beginFill("rgba("+color.r+","+color.g+","+color.b+",1)").drawRect(x, y, bar_width, 100);

        bin_bars.push(rect);
        stage.addChild(rect);
    }

    // exploding circle thingies
    var bursts = [];

    var long_past_volumes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var lvi = 0;

    var past_volumes = [0, 0, 0, 0];
    var vi = 0;

    // guess tempo
    var avg_tempo_delta = 1000;
    var tempo_samples = 0;
    var last_tempo_sample = 0;

    var counter = 0;
    function updateVisualizer() {
        // Schedule the next update
        requestAnimationFrame(updateVisualizer);

        // Get the new frequency data
        analyser.getByteFrequencyData(frequencyData);

        var total_volume = 0;

        // update colored vertical bars for each of the fft bins
        for (var i = 0; i < frequencyData.length; i++) {
            var x = bar_width * i;
            var y = 0;
            var color = HSVtoRGB((hue_shift + i / frequencyData.length) % 1, 1.0, 1.0);
            var height = (frequencyData[i] / 255) * stage.canvas.height;
            bin_bars[i].graphics.clear();
            bin_bars[i].graphics.beginFill("rgba("+color.r+","+color.g+","+color.b+",1)").drawRect(x, y, bar_width, height);

            // calculate volume
            total_volume += frequencyData[i];
        }

        var past_volume = 0;
        for (var i = 0; i < past_volumes.length; i++) {
            past_volume += past_volumes[i];
        }
        past_volume /= past_volumes.length;

        // insert latest volume measure
        past_volumes[vi] = total_volume;
        vi = (vi + 1) % past_volumes.length;
        long_past_volumes[lvi] = total_volume;
        lvi = (lvi + 1) % long_past_volumes.length;

        // Is there a significant volume increase?
        if (total_volume > past_volume) {
            // Add exploding circle thingy
            var strength = (total_volume/past_volume - 1) / 0.05;
            var times = strength > 0.05 ? 2 : 1;
            for (var i = 0; i < times; i++) {
                var new_burst = new createjs.Shape();
                var color = HSVtoRGB(Math.random(), Math.random(), Math.random());
                new_burst.graphics.beginFill("rgba("+color.r+","+color.g+","+color.b+",1)").drawCircle(0, 0, 20);
                new_burst.x = Math.random() * stage.canvas.width;
                new_burst.y = Math.random() * stage.canvas.height;
                bursts.push({"burst" : new_burst, "frames" : 20, "counter" : 0, "strength" : strength});

                stage.addChild(new_burst);
            }

            // update tempo guessing
            if (strength > 2) {
                avg_tempo_delta = ((avg_tempo_delta * tempo_samples) + (counter - last_tempo_sample)) / (tempo_samples + 1)
                tempo_samples += 1;
                bg_blip_counter = max_bg_blip_counter;
            }
        }

        // update the bursts!
        for (var i = 0; i < bursts.length; ) {
            var burst = bursts[i];
            if (burst.counter >= burst.frames) {
                // remove from the stage
                stage.removeChild(burst.burst);
                bursts.splice(i, 1);
            } else {
                // update the burst
                burst.burst.scaleX = (burst.counter/burst.frames) * burst.strength;
                burst.burst.scaleY = (burst.counter/burst.frames) * burst.strength;
                burst.burst.alpha = 1 - (burst.counter/burst.frames);

                burst.counter++;
                i++;
            }
        }

        // update bg blip
        var color_amount = Math.floor(255 * (max_bg_blip_counter - bg_blip_counter) / max_bg_blip_counter);
        bg_blip.graphics.clear();
        bg_blip.graphics.beginFill("rgba("+color_amount+","+color_amount+","+color_amount+",1)").drawRect(0, 0, stage.canvas.width, stage.canvas.height);
        if (bg_blip_counter > 0) {
            bg_blip_counter--;
        }

        // has the volume stayed the same for a long time?
        var x = average(long_past_volumes);
        if (x.deviation < 800) {
            // shift the hues of the colored bars
            hue_shift += 0.04;
        } else {
            hue_shift -= 0.005;
        }

        // Update the visualisation
        stage.update();

        counter++;
    };

    // play the audio
    audioElement.play();

    // begin the visualization
    updateVisualizer();
}
