const { DateTime } = require('luxon');
const axios = require('axios');
const { channel } = require('../../utils/pusher');
const fs = require('fs');
const https = require('https');

const socket_jobvacancy = async () => {
  channel.bind('JobVacancy_notification', async (itemdata) => {
    // console.log(itemdata);
    try {
      // Use global.sock directly here
      if (!global.sock || !global.sock.user) {
        console.log('WhatsApp connection is not established.');
        return;
      }

      if (!itemdata || !itemdata.data) {
        console.log('itemdata is undefined or missing data property.');
        return;
      }

      const data = itemdata.data;

      switch (data.type) {
        case 'send_to_verification':
          if (data.number.length > 0) {
            const jobData = itemdata.data.data;

            for (const recipient of data.number) {
              let message = `*PERSETUJUAN JOB VACANCY*\n\n`;
              message += `Halo, Selamat siang ${recipient.name?.includes('@') ? 'Bapak/Ibu' : 'Pak/Bu'} ${recipient.name || ''}\n\n`;
              message += `Dengan hormat,\n`;
              message += `Anda memiliki permintaan verifikasi untuk posisi jabatan baru dengan detail sebagai berikut:\n\n`;

              message += `📋 *DETAIL JABATAN*\n`;
              message += `━━━━━━━━━━━━━━━\n`;
              message += `Nama Jabatan : ${jobData.nama_jabatan} (${jobData.id})\n`;
              message += `Kategori : ${jobData.kategori === 1 ? 'Operasional' : 'Non-Operasional'}\n`;
              message += `Tingkat Pengalaman : ${jobData.status_pengalaman === 1 ? 'Experienced' : 'Fresh Graduate'}\n`;

              // Handle tujuan jabatan HTML
              const cleanTujuan = jobData.tujuan_jabatan
                ? jobData.tujuan_jabatan
                    .replace(/<p[^>]*>/g, '')
                    .replace(/<\/p>/g, '\n')
                    .replace(/&nbsp;/g, ' ')
                    .trim()
                : '-';
              message += `Tujuan Jabatan : ${cleanTujuan}\n`;

              // Handle uraian tugas JSON
              try {
                if (jobData.uraian_tugas) {
                  const uraianTugas = JSON.parse(jobData.uraian_tugas);
                  const tugasList = Object.values(uraianTugas)
                    .filter((tugas) => tugas && tugas !== '-')
                    .map((tugas) => `- ${tugas}`)
                    .join('\n');
                  if (tugasList) {
                    message += `Uraian Tugas :\n${tugasList}\n`;
                  }
                }
              } catch (e) {}

              message += `\n📑 *KUALIFIKASI*\n`;
              message += `━━━━━━━━━━━━━━━\n`;
              // Handle jenis kelamin L/P/Null
              const jenisKelamin =
                jobData.jenis_kelamin === 'L'
                  ? 'Laki-laki'
                  : jobData.jenis_kelamin === 'P'
                    ? 'Perempuan'
                    : 'Laki-laki/Perempuan';
              message += `Jenis Kelamin : ${jenisKelamin}\n`;
              message += `Umur (range) : ${jobData.umur || 'Batasan usia tidak ditentukan'}\n`;

              if (jobData.tinggi_badan)
                message += `Tinggi Badan : ${jobData.tinggi_badan} cm\n`;
              if (jobData.berat_badan)
                message += `Berat Badan : ${jobData.berat_badan} kg\n`;
              if (jobData.pendidikan)
                message += `Pendidikan : ${jobData.pendidikan}\n`;
              if (jobData.jurusan)
                message += `Jurusan : ${jobData.jurusan.replace('#', ', ')}\n`;
              if (jobData.pengalaman)
                message += `Pengalaman : ${jobData.pengalaman}\n`;
              message += `Kemampuan Bahasa : ${jobData.bahasa === '1' ? 'Indonesia, Inggris' : 'Indonesia'}\n`;

              // Handle catatan tambahan HTML
              if (jobData.lainnya) {
                const cleanLainnya = jobData.lainnya
                  .replace(/<p[^>]*>/g, '')
                  .replace(/<\/p>/g, '')
                  .trim();
                if (cleanLainnya)
                  message += `Catatan Tambahan : ${cleanLainnya}\n`;
              }

              // Handle sertifikat JSON
              try {
                if (jobData.sertifikat) {
                  const sertifikat = JSON.parse(jobData.sertifikat);
                  const sertList = Object.values(sertifikat)
                    .filter((sert) => sert && sert !== '-')
                    .map((sert) => `- ${sert}`)
                    .join('\n');
                  if (sertList) {
                    message += `Sertifikat Keahlian :\n${sertList}\n`;
                  } else {
                    message += `Sertifikat Keahlian : Tidak ada\n`;
                  }
                } else {
                  message += `Sertifikat Keahlian : Tidak ada\n`;
                }
              } catch (e) {
                message += `Sertifikat Keahlian : Tidak ada\n`;
              }

              // Handle keterampilan JSON
              try {
                if (jobData.keterampilan) {
                  const keterampilan = JSON.parse(jobData.keterampilan);
                  const skillList = Object.values(keterampilan)
                    .filter((skill) => skill && skill !== '-')
                    .map((skill) => `- ${skill}`)
                    .join('\n');
                  if (skillList) {
                    message += `Keterampilan Teknis :\n${skillList}\n`;
                  }
                }
              } catch (e) {}

              // Handle non teknis JSON
              try {
                if (jobData.non_teknis) {
                  const nonTeknis = JSON.parse(jobData.non_teknis);
                  const nonTeknisList = Object.values(nonTeknis)
                    .filter((skill) => skill && skill !== '-')
                    .map((skill) => `- ${skill}`)
                    .join('\n');
                  if (nonTeknisList) {
                    message += `Keterampilan Non Teknis :\n${nonTeknisList}\n`;
                  }
                }
              } catch (e) {}

              message += `\n📌 *PETUNJUK PERSETUJUAN*\n`;
              message += `━━━━━━━━━━━━━━━\n`;
              message += `1. Silakan reply pesan ini dengan memasukkan Gaji dan Batas Waktu Lowongan untuk memberikan persetujuan\n`;
              message += `2. Format balasan :\n`;
              message += `   • Gaji, Batas Waktu (Tahun-Bulan-Hari)\n`;
              message += `      Contoh : 5000000, 2025-01-31\n\n`;

              message += `*Catatan:*\n`;
              message += `Mohon dapat menulis gaji dalam format angka saja, sesuai dengan format yang telah ditentukan.\n`;
              message += `_Pesan ini dikirim secara otomatis oleh Digital Architect SRS Bot_\n`;

              queue.push({
                type: 'send_message',
                data: {
                  to: `${recipient.phone_number}@s.whatsapp.net`,
                  message,
                },
              });
            }
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.log('Error fetching data:', error);
    }
  });
};

module.exports = {
  socket_jobvacancy,
};
