const axios = require('axios');
const Queue = require('../../../../utils/queue');
require('dotenv').config();
class GradingMill {
  constructor() {
    this.credentials = {
      email: process.env.MILL_EMAIL,
      password: process.env.MILL_PASSWORD,
    };

    // Ensure baseUrl is properly set
    if (!process.env.MILL_API_URL) {
      throw new Error('MILL_API_URL environment variable is not set');
    }

    // Remove any trailing slashes from the base URL
    this.baseUrl = process.env.MILL_API_URL.replace(/\/+$/, '');
    this.queue = global.queue;
  }

  async getMillData(sock) {
    try {
      if (!this.baseUrl) {
        throw new Error('Base URL is not configured');
      }

      const response = await axios.get(`${this.baseUrl}/getdatamilljobs`, {
        params: this.credentials,
      });

      const { data, id_jobs, pdf_name, image_name } = response.data;

      if (!data || data.length === 0) {
        global.queue.emitLog('No mill data available to process', 'info');
        return;
      }

      for (const itemdata of data) {
        const message = this.formatGradingMessage(itemdata);
        const targetGroup = this.getTargetGroup(itemdata.mill);

        if (!targetGroup) {
          global.queue.emitLog(
            `No target group found for mill: ${itemdata.mill}`,
            'warning'
          );
          continue;
        }

        // Add message to queue
        this.queue.push({
          type: 'send_message',
          queueType: 'grading',
          data: {
            to: targetGroup,
            message: message,
          },
        });

        // Update processed data
        await this.updateDataMill({
          id: id_jobs,
          pdf_name: pdf_name,
          image_name: image_name,
        });
      }

      global.queue.emitLog(
        `Processed ${data.length} mill data entries`,
        'success'
      );
    } catch (error) {
      global.queue.emitLog(
        `Error fetching mill data: ${error.message}`,
        'error'
      );
      throw error;
    }
  }

  async runJobsMill() {
    try {
      if (!this.baseUrl) {
        throw new Error('Base URL is not configured');
      }

      const response = await axios.get(`${this.baseUrl}/getdatamill`, {
        params: this.credentials,
      });
      global.queue.emitLog('Successfully fetched mill jobs', 'success');
      return response.data;
    } catch (error) {
      global.queue.emitLog(
        `Error fetching mill jobs: ${error.message}`,
        'error'
      );
      throw error;
    }
  }

  async updateDataMill(data) {
    try {
      await axios.post(`${this.baseUrl}/updatedatamill`, {
        ...this.credentials,
        id: data.id,
        pdf_name: data.pdf_name,
        image_name: data.image_name,
      });
      global.queue.emitLog('Successfully updated mill data', 'success');
    } catch (error) {
      global.queue.emitLog(
        `Error updating mill data: ${error.message}`,
        'error'
      );
      throw error;
    }
  }

  formatGradingMessage(itemdata) {
    let message = `*Berikut Hasil Grading Total ${itemdata.estate} ${itemdata.afdeling}*:\n`;
    message += `*Tanggal*: ${itemdata.Tanggal}\n`;
    message += `*Jam*: ${itemdata.waktu_grading}\n`;
    message += `*Ripeness*: ${itemdata.Ripeness} jjg (${itemdata.percentase_ripenes}%)\n`;
    message += `*Unripe*: ${itemdata.Unripe} jjg (${itemdata.persenstase_unripe}%)\n`;
    message += `•0 brondol: ${itemdata.nol_brondol} jjg (${itemdata.persentase_nol_brondol}%)\n`;

    itemdata.pemanen_list_tanpabrondol?.tanpaBrondol_list?.forEach(
      (item, index) => {
        message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${item.tanpaBrondol} jjg\n`;
      }
    );

    message += `•< brondol: ${itemdata.kurang_brondol} jjg (${itemdata.persentase_brondol}%)\n`;

    itemdata.pemanen_list_kurangbrondol?.kurangBrondol_list?.forEach(
      (item, index) => {
        message += `${index + 1}. No. Pemanen : ${item.no_pemanen} = ${item.kurangBrondol} jjg\n`;
      }
    );

    message += `*Overripe*:  ${itemdata.Overripe} jjg (${itemdata.persentase_overripe}%)\n`;
    message += `*Empty bunch*: ${itemdata.empty_bunch} jjg (${itemdata.persentase_empty_bunch}%)\n`;
    message += `*Rotten bunch*: ${itemdata.rotten_bunch} jjg (${itemdata.persentase_rotten_bunce}%)\n`;
    message += `*Abnormal*: ${itemdata.Abnormal} jjg (${itemdata.persentase_abnormal}%)\n`;
    message += `*Dirt*: ${itemdata.Dirt} Kg (${itemdata.persentase}%)\n`;
    message += `*Loose Fruit*: ${itemdata.loose_fruit} Kg (${itemdata.persentase_lose_fruit}%)\n\n`;
    message += `Jumlah janjang di Grading: ${itemdata.jjg_grading} jjg\n`;
    message += `Jumlah janjang di SPB: ${itemdata.jjg_spb} jjg\n`;
    message += `Jumlah Selisih janjang: ${itemdata.jjg_selisih} jjg (${itemdata.persentase_selisih}%)\n`;
    if (itemdata.update_by !== null) {
      message += `Laporan diperbaharui\n`;
      message += `*Telah diedit oleh*: ${itemdata.status_edit}\n`;
    }
    message += `Generated by Digital Architect SRS bot`;

    return message;
  }

  getTargetGroup(mill) {
    const groups = {
      SYM: '6281397270799-1635156024@g.us',
      SGM: '6282257572112-1635223872@g.us',
      SLM: '6281397270799-1565316655@g.us',
      NBM: '6285655573821-1566449850@g.us',
      MLM: '120363332857987276@g.us',
      NKM: '120363046524351245@g.us',
      SCM: '120363332360538214@g.us',
    };
    return groups[mill];
  }
}

module.exports = new GradingMill();
