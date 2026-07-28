const shuffle = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const candidateM = [1,2,3,4,5,6];
const targetCourts = 2;

console.time('mc');
for(let i=0; i<20000; i++) {
    const selectedM = shuffle(candidateM).slice(0, targetCourts * 2);
}
console.timeEnd('mc');
