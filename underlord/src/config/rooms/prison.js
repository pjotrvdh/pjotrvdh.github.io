export default {
    name: 'Prison',
    /** Gold per tile. */
    cost: 150,
    color: '#8c93a3',
    /** Shown in the Rooms tab. */
    tip: 'Heroes your creatures defeat are taken prisoner (one per tile) and rise as Skeletons',
    /** Seconds a knocked-out hero waits for an imp to carry it to the Prison before it dies. */
    outTime: 45,
    /** Share of its health a prisoner loses per second; at 0 it dies and rises as a Skeleton. */
    starve: 0.02,
};
