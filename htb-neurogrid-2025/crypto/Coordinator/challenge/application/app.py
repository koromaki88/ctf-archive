from flask import Flask, jsonify
import shrine

app = Flask(__name__)

SCROLL = open('/flag.txt', 'rb').read()

@app.route('/read-star-coordinates', methods=['GET'])
def read_star_coordinates():
    val = shrine.observe_constellation()
    r, d = list(map(int, str(val).split('.')))
    return jsonify({
        'south': int(val < 0),
        'lat': abs(r),
        'lon': int(d)
    }), 200

@app.route('/invoke-synchro', methods=['GET'])
def invoke_synchro():
    chant = int.to_bytes(shrine.draw_cosmic_pattern(len(SCROLL)*8), length=len(SCROLL), byteorder='little')
    echo = shrine.bind(chant, SCROLL)
    return jsonify({'echo': echo.hex()}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=1337, debug=False)